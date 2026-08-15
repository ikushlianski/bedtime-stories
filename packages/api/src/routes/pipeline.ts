import { Router } from 'express'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import {
  runQuestionsPhase,
  type PipelineModels,
  type PipelineModelFallbacks,
  type PipelinePromptVersions,
} from '@bedtime/core/pipeline/orchestrator'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories, planQuestions } from '@bedtime/core/db/schema'
import { loadUniverseContext } from './load-universe-context'
import { getStoryUniverseIds } from './story-universe-links'
import {
  toPublicStatus,
  type PipelineInternalStatus,
  type PublicPipelineStatus,
} from './pipeline-status'
import { getPipelineStatus, setPipelineStatus, getCurrentStep, getStepSummaries, subscribePipelineEvents } from './pipeline-state'
import { defaultModels, defaultPromptVersions, resolvePipelineModels, loadStoryOverrides } from './pipeline-defaults'
import pipelineQuestionsRouter from './pipeline-questions'
import { dispatchAutoPipeline } from './pipeline-dispatch'
import { triggerTextPhase } from './pipeline-text-trigger'
import { withPipelineTraceIfNone } from '@bedtime/observability'

export { toPublicStatus, type PipelineInternalStatus, type PublicPipelineStatus }
export { getPipelineStatus, setPipelineStatus }
export { defaultModels, defaultPromptVersions }
export { triggerTextPhase }
export type { PipelineModels, PipelineModelFallbacks, PipelinePromptVersions }

const router = Router()

router.use('/', pipelineQuestionsRouter)

const runPipelineSchema = z.object({
  storyId: z.number().int().positive(),
  seed: z.string().min(1),
  model: z.string().optional(),
  manualTopicIds: z.array(z.number().int().positive()).optional(),
})

router.post('/run', validate(runPipelineSchema), async (req, res) => {
  const { storyId, seed, model, manualTopicIds } = req.body as z.infer<typeof runPipelineSchema>

  try {
    let [storyRow] = await db.select().from(stories).where(eq(stories.id, storyId))

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

    if (model) {
      const currentOverrides = (storyRow.agentOverrides as Record<string, unknown> | null) ?? {}
      const nextOverrides = {
        ...currentOverrides,
        plotterQuestions: { ...(currentOverrides.plotterQuestions ?? {}), model },
      }
      await db.update(stories).set({ agentOverrides: nextOverrides }).where(eq(stories.id, storyId))
      storyRow = { ...storyRow, agentOverrides: nextOverrides }
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

    const universeIds = await getStoryUniverseIds(storyId, storyRow.groupId)
    const { universeSystemPrompt, universeContext, styleGuide } = await loadUniverseContext(universeIds)

    const mode = storyRow.mode ?? 'auto'

    if (mode === 'auto') {
      await dispatchAutoPipeline({
        storyId,
        seed,
        universeSystemPrompt,
        universeContext,
        styleGuide,
        universeIds,
        ...(manualTopicIds && manualTopicIds.length > 0 ? { manualTopicIds } : {}),
      })
      res.json({ started: true, storyId, phase: 'auto' })
      return
    }

    await withPipelineTraceIfNone(String(storyId), async () => {
      const [sashaContext, storyOverrides] = await Promise.all([
        synthesizeSashaContext(),
        loadStoryOverrides(storyId),
      ])
      const { models: questionModels, fallbacks: questionFallbacks } = await resolvePipelineModels(storyRow.groupId ?? null, storyOverrides)

      const questions = await runQuestionsPhase({
        seed,
        storyId,
        models: questionModels,
        fallbacks: questionFallbacks,
        ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
        ...(universeContext !== undefined ? { universeContext } : {}),
        ...(sashaContext !== null ? { sashaContext } : {}),
      })

      await db.delete(planQuestions).where(eq(planQuestions.storyId, storyId))

      await db.insert(planQuestions).values(
        questions.map((q) => ({ storyId, questionText: q.question, answerOptions: q.options })),
      )

      setPipelineStatus(storyId, 'questions_pending')
    })

    res.json({ started: true, storyId, phase: 'questions' })
  } catch (err) {
    setPipelineStatus(storyId, 'questions_failed')
    console.error('POST /pipeline/run failed:', err)
    res.status(500).json({ error: 'Failed to start pipeline' })
  }
})

type StepStatus = 'completed' | 'running' | 'pending' | 'failed'

function buildFullPipelineSteps(
  mode: 'auto' | 'manual',
  internal: PipelineInternalStatus | undefined,
  activeStep: string | null,
  summaries: Map<string, string>,
): Array<{ name: string; status: StepStatus; agent: string; summary?: string }> {
  const result: Array<{ name: string; status: StepStatus; agent: string; summary?: string }> = []

  if (mode === 'manual') {
    let qStatus: StepStatus = 'pending'

    if (internal === 'questions_failed') qStatus = 'failed'
    else if (internal === undefined || internal === 'questions_pending') qStatus = 'running'
    else qStatus = 'completed'

    result.push({ name: 'Questions', status: qStatus, agent: 'Questions' })
  }

  const planDone = internal === 'plan_ready' || internal === 'text_running' || internal === 'text_review' || internal === 'text_ready' || internal === 'text_failed'

  let pStatus: StepStatus = 'pending'

  if (internal === 'plan_failed') pStatus = 'failed'
  else if (internal === 'plan_running') pStatus = activeStep === 'TitleGenerator' ? 'completed' : 'running'
  else if (planDone) pStatus = 'completed'

  const plotterSummary = summaries.get('Plotter')

  result.push({ name: 'Plotter', status: pStatus, agent: 'Plotter', ...(plotterSummary !== undefined ? { summary: plotterSummary } : {}) })

  let wStatus: StepStatus = 'pending'

  if (internal === 'text_failed') wStatus = 'failed'
  else if (internal === 'text_running') wStatus = activeStep === 'Writer' ? 'running' : 'pending'
  else if (internal === 'text_review' || internal === 'text_ready') wStatus = 'completed'

  const writerSummary = summaries.get('Writer')

  result.push({ name: 'Writer', status: wStatus, agent: 'Writer', ...(writerSummary !== undefined ? { summary: writerSummary } : {}) })

  const criticSummary = summaries.get('WriterCritic')

  if (criticSummary !== undefined) {
    result.push({ name: 'WriterCritic', status: 'completed', agent: 'WriterCritic', summary: criticSummary })
  }

  return result
}

async function inferStatusFromDb(storyId: number): Promise<PipelineInternalStatus | undefined> {
  const [row] = await db.select().from(stories).where(eq(stories.id, storyId))

  if (!row) return undefined

  if (row.textV2 !== null && row.textV2 !== undefined) {
    return 'text_ready'
  }

  if (row.textV1 !== null && row.textV1 !== undefined) {
    return 'text_review'
  }

  if (row.planV1 !== null && row.planV1 !== undefined) {
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

  if (unanswered.length > 0 && !hasUnanswered) {
    return 'questions_answered'
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

    const activeStep = isRunning
      ? (getCurrentStep(storyIdRaw) ?? (publicStatus.status === 'plan_running' ? 'Plotter' : 'Writer'))
      : null

    const [storyRow] = await db.select({ mode: stories.mode }).from(stories).where(eq(stories.id, storyIdRaw))
    const storyMode = storyRow?.mode ?? 'manual'

    const summaries = getStepSummaries(storyIdRaw)
    const steps = buildFullPipelineSteps(storyMode, internal, activeStep, summaries)

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

const TERMINAL_INTERNAL_STATUSES = new Set(['plan_ready', 'text_ready', 'text_review', 'plan_failed', 'text_failed', 'questions_failed'])

router.get('/stream/:storyId', (req, res) => {
  const storyId = parseInt(req.params['storyId'] ?? '', 10)

  if (isNaN(storyId)) {
    res.status(400).json({ error: 'Invalid storyId' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  console.log(`[sse] storyId=${storyId} client connected`)

  const send = (eventType: string, data: unknown) => {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const unsubscribe = subscribePipelineEvents(storyId, (event) => {
    if (event.type === 'chunk') {
      send('chunk', { text: event.text })
    } else if (event.type === 'chunk_reset') {
      send('chunk_reset', {})
    } else if (event.type === 'step') {
      send('step', event)
    } else if (event.type === 'status') {
      send('status', event)

      if (TERMINAL_INTERNAL_STATUSES.has(event.status)) {
        unsubscribe()
        setImmediate(() => res.end())
      }
    }
  })

  req.on('close', () => {
    console.log(`[sse] storyId=${storyId} client disconnected`)
    unsubscribe()
  })
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
