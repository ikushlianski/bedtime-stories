import { Router } from 'express'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import {
  runQuestionsPhase,
  type PipelineModels,
  type PipelinePromptVersions,
} from '@bedtime/core/pipeline/orchestrator'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories, storyGroups, planQuestions } from '@bedtime/core/db/schema'
import {
  toPublicStatus,
  type PipelineInternalStatus,
  type PublicPipelineStatus,
} from './pipeline-status'
import { getPipelineStatus, setPipelineStatus, getCurrentStep } from './pipeline-state'
import { defaultModels, defaultPromptVersions } from './pipeline-defaults'
import pipelineQuestionsRouter from './pipeline-questions'
import { triggerAutoPipeline } from './pipeline-auto-trigger'
import { triggerTextPhase } from './pipeline-text-trigger'

export { toPublicStatus, type PipelineInternalStatus, type PublicPipelineStatus }
export { getPipelineStatus, setPipelineStatus }
export { defaultModels, defaultPromptVersions }
export { triggerTextPhase }
export type { PipelineModels, PipelinePromptVersions }

const router = Router()

router.use('/', pipelineQuestionsRouter)

const runPipelineSchema = z.object({
  storyId: z.number().int().positive(),
  seed: z.string().min(1),
})

router.post('/run', validate(runPipelineSchema), async (req, res) => {
  try {
    const { storyId, seed } = req.body as z.infer<typeof runPipelineSchema>

    const [storyRow] = await db.select().from(stories).where(eq(stories.id, storyId))

    if (!storyRow) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    if (storyRow.source === 'user') {
      res.status(422).json({
        error: 'Pipeline cannot run on user-authored stories',
      })
      return
    }

    const current = getPipelineStatus(storyId)

    if (
      current !== undefined &&
      current !== 'plan_failed' &&
      current !== 'text_failed' &&
      current !== 'questions_pending'
    ) {
      res.status(409).json({
        error: 'Pipeline already in progress or completed for this story',
        currentStatus: current,
      })
      return
    }

    let universeSystemPrompt: string | undefined
    let universeContext: string | undefined
    let styleGuide: string | undefined

    if (storyRow.groupId !== null && storyRow.groupId !== undefined) {
      const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, storyRow.groupId))

      if (group) {
        universeSystemPrompt = group.systemPrompt
        universeContext = group.universeContext ?? undefined
        styleGuide = group.styleGuide ?? undefined
      }
    }

    const mode = storyRow.mode ?? 'auto'

    if (mode === 'auto') {
      triggerAutoPipeline(storyId, seed, universeSystemPrompt, universeContext, styleGuide)
      res.json({ started: true, storyId, phase: 'auto' })
      return
    }

    const sashaContext = await synthesizeSashaContext()

    const questions = await runQuestionsPhase({
      seed,
      storyId,
      models: defaultModels,
      ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
      ...(universeContext !== undefined ? { universeContext } : {}),
      ...(sashaContext !== null ? { sashaContext } : {}),
    })

    await db.delete(planQuestions).where(eq(planQuestions.storyId, storyId))

    await db.insert(planQuestions).values(
      questions.map((q) => ({ storyId, questionText: q.question, answerOptions: q.options })),
    )

    setPipelineStatus(storyId, 'questions_pending')

    res.json({ started: true, storyId, phase: 'questions' })
  } catch (err) {
    console.error('POST /pipeline/run failed:', err)
    res.status(500).json({ error: 'Failed to start pipeline' })
  }
})

const PIPELINE_STEP_NAMES = ['Plotter', 'PlotCritic', 'Writer', 'WriterCritic'] as const

async function inferStatusFromDb(storyId: number): Promise<PipelineInternalStatus | undefined> {
  const [row] = await db.select().from(stories).where(eq(stories.id, storyId))

  if (!row) return undefined

  if (row.textV2 !== null && row.textV2 !== undefined) {
    return 'text_ready'
  }

  if (row.planFinal !== null && row.planFinal !== undefined) {
    return 'plan_ready'
  }

  const unanswered = await db
    .select()
    .from(planQuestions)
    .where(eq(planQuestions.storyId, storyId))

  const hasUnanswered = unanswered.some(
    (q) => q.answerText === null || q.answerText === undefined,
  )

  if (unanswered.length > 0 && hasUnanswered) {
    return 'questions_pending'
  }

  return undefined
}

router.get('/status/:storyId', async (req, res) => {
  try {
    const storyIdRaw = parseInt(req.params['storyId'] ?? '', 10)

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    let internal = getPipelineStatus(storyIdRaw)

    if (internal === undefined) {
      internal = await inferStatusFromDb(storyIdRaw)
    }

    const publicStatus = toPublicStatus(internal)

    const isRunning = publicStatus.status === 'plan_running' || publicStatus.status === 'text_running'
    const isAllDone = publicStatus.status === 'plan_ready' || publicStatus.status === 'text_ready' || publicStatus.status === 'text_review'
    const isFailed = publicStatus.status === 'failed'

    const activeStep = isRunning
      ? (getCurrentStep(storyIdRaw) ?? (publicStatus.status === 'plan_running' ? 'Plotter' : 'Writer'))
      : null

    let passedActive = false
    const steps = PIPELINE_STEP_NAMES.map((name) => {
      if (isAllDone) return { name, status: 'completed', agent: name }
      if (isFailed) return { name, status: 'failed', agent: name }

      if (!isRunning) return { name, status: 'pending', agent: name }

      if (name === activeStep) {
        passedActive = true
        return { name, status: 'running', agent: name }
      }

      if (passedActive) return { name, status: 'pending', agent: name }

      return { name, status: 'completed', agent: name }
    })

    res.json({
      story_id: storyIdRaw,
      status: publicStatus.status,
      phase: publicStatus.phase,
      current_step: activeStep,
      steps,
    })
  } catch (err) {
    console.error('GET /pipeline/status/:storyId failed:', err)
    res.status(500).json({ error: 'Failed to get pipeline status' })
  }
})

router.get('/snapshot/:storyId', async (req, res) => {
  try {
    const storyIdRaw = parseInt(req.params['storyId'] ?? '', 10)

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const [snapshot] = await db
      .select()
      .from(runSnapshots)
      .where(eq(runSnapshots.storyId, storyIdRaw))
      .orderBy(desc(runSnapshots.createdAt))
      .limit(1)

    if (!snapshot) {
      res.status(404).json({ error: 'No snapshot found for this story' })
      return
    }

    res.json({
      story_id: snapshot.storyId,
      psychologist_plan_output: snapshot.psychologistPlanOutput,
      psychologist_text_output: snapshot.psychologistTextOutput,
      plot_critic_output: snapshot.plotCriticOutput,
      writer_critic_output: snapshot.writerCriticOutput,
      plan_iterations_count: snapshot.planIterationsCount,
    })
  } catch (err) {
    console.error('GET /pipeline/snapshot/:storyId failed:', err)
    res.status(500).json({ error: 'Failed to get pipeline snapshot' })
  }
})

export default router
