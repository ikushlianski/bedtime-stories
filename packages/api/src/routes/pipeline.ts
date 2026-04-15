import { Router } from 'express'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import {
  runPlanPhase,
  runTextPhase,
  type PipelineModels,
  type PipelinePromptVersions,
  type PlanPhaseResult,
  type TextPhaseResult,
} from '@bedtime/core/pipeline/orchestrator'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories } from '@bedtime/core/db/schema'
import {
  toPublicStatus,
  type PipelineInternalStatus,
  type PublicPipelineStatus,
} from './pipeline-status'
import {
  buildPlanSnapshotInsert,
  buildTextSnapshotUpdate,
  buildPlanStoriesUpdate,
  buildTextStoriesUpdate,
} from './pipeline-persistence'

export { toPublicStatus, type PipelineInternalStatus, type PublicPipelineStatus }

const router = Router()

const pipelineStatusMap = new Map<number, PipelineInternalStatus>()

export function getPipelineStatus(storyId: number): PipelineInternalStatus | undefined {
  return pipelineStatusMap.get(storyId)
}

export function setPipelineStatus(storyId: number, status: PipelineInternalStatus): void {
  pipelineStatusMap.set(storyId, status)
}

export const defaultModels: PipelineModels = {
  plotter: 'claude-sonnet-4-6',
  psychologist: 'claude-sonnet-4-6',
  plotCritic: 'claude-haiku-4-5-20251001',
  writer: 'claude-sonnet-4-6',
  writerCritic: 'claude-haiku-4-5-20251001',
}

export const defaultPromptVersions: PipelinePromptVersions = {
  plotter: 1,
  psychologistPlan: 1,
  psychologistText: 1,
  plotCritic: 1,
  writer: 1,
  writerCritic: 1,
}

async function persistPlanPhase(storyId: number, plan: PlanPhaseResult): Promise<void> {
  await db.insert(runSnapshots).values(buildPlanSnapshotInsert(storyId, plan))

  await db.update(stories).set(buildPlanStoriesUpdate(plan)).where(eq(stories.id, storyId))
}

async function persistTextPhase(storyId: number, text: TextPhaseResult): Promise<void> {
  const [existing] = await db
    .select()
    .from(runSnapshots)
    .where(eq(runSnapshots.storyId, storyId))
    .orderBy(desc(runSnapshots.createdAt))
    .limit(1)

  if (existing) {
    await db
      .update(runSnapshots)
      .set(buildTextSnapshotUpdate(text))
      .where(eq(runSnapshots.id, existing.id))
  }

  await db.update(stories).set(buildTextStoriesUpdate(text)).where(eq(stories.id, storyId))
}

export function triggerPlanPhase(storyId: number, seed: string): void {
  setPipelineStatus(storyId, 'plan_running')

  runPlanPhase({
    seed,
    storyId,
    models: defaultModels,
    promptVersions: defaultPromptVersions,
  })
    .then(async (plan) => {
      try {
        await persistPlanPhase(storyId, plan)
        setPipelineStatus(storyId, 'plan_ready')
      } catch (dbError) {
        console.error(`Failed to persist plan phase for storyId=${storyId}:`, dbError)
        setPipelineStatus(storyId, 'plan_failed')
      }
    })
    .catch((planError) => {
      setPipelineStatus(storyId, 'plan_failed')
      console.error(`Plan phase failed for storyId=${storyId}:`, planError)
    })
}

export function triggerTextPhase(storyId: number, seed: string, planFinal: string): void {
  setPipelineStatus(storyId, 'text_running')

  runTextPhase({
    seed,
    planFinal,
    storyId,
    models: defaultModels,
    promptVersions: defaultPromptVersions,
  })
    .then(async (text) => {
      try {
        await persistTextPhase(storyId, text)
        setPipelineStatus(storyId, 'text_ready')
      } catch (dbError) {
        console.error(`Failed to persist text phase for storyId=${storyId}:`, dbError)
        setPipelineStatus(storyId, 'text_failed')
      }
    })
    .catch((textError) => {
      setPipelineStatus(storyId, 'text_failed')
      console.error(`Text phase failed for storyId=${storyId}:`, textError)
    })
}

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

    if (current !== undefined && current !== 'plan_failed' && current !== 'text_failed') {
      res.status(409).json({
        error: 'Pipeline already in progress or completed for this story',
        currentStatus: current,
      })
      return
    }

    triggerPlanPhase(storyId, seed)

    res.json({ started: true, storyId, phase: 'plan' })
  } catch (err) {
    console.error('POST /pipeline/run failed:', err)
    res.status(500).json({ error: 'Failed to start pipeline' })
  }
})

const PIPELINE_STEP_NAMES = ['Plotter', 'Psychologist', 'PlotCritic', 'Writer', 'WriterCritic'] as const

async function inferStatusFromDb(storyId: number): Promise<PipelineInternalStatus | undefined> {
  const [row] = await db.select().from(stories).where(eq(stories.id, storyId))

  if (!row) return undefined

  if (row.textV2 !== null && row.textV2 !== undefined) {
    return 'text_ready'
  }

  if (row.planFinal !== null && row.planFinal !== undefined) {
    return 'plan_ready'
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

    const steps = PIPELINE_STEP_NAMES.map((name) => ({
      name,
      status:
        publicStatus.status === 'plan_ready' || publicStatus.status === 'text_ready'
          ? 'completed'
          : publicStatus.status === 'failed'
            ? 'failed'
            : publicStatus.status === 'plan_running' || publicStatus.status === 'text_running'
              ? 'running'
              : 'pending',
      agent: name,
    }))

    res.json({
      story_id: storyIdRaw,
      status: publicStatus.status,
      phase: publicStatus.phase,
      current_step:
        publicStatus.status === 'plan_running'
          ? 'Plotter'
          : publicStatus.status === 'text_running'
            ? 'Writer'
            : null,
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
