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
import type { NewRunSnapshot } from '@bedtime/core/db/types'

const router = Router()

export type PipelineInternalStatus =
  | 'plan_running'
  | 'plan_ready'
  | 'plan_failed'
  | 'text_running'
  | 'text_ready'
  | 'text_failed'

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
  const snapshotRow: NewRunSnapshot = {
    storyId,
    plotterModel: plan.models.plotter,
    plotterPromptVersion: plan.promptVersions.plotter,
    psychologistPlanModel: plan.models.psychologist,
    psychologistPlanPromptVersion: plan.promptVersions.psychologistPlan,
    plotCriticModel: plan.models.plotCritic,
    plotCriticPromptVersion: plan.promptVersions.plotCritic,
    writerModel: plan.models.writer,
    writerPromptVersion: plan.promptVersions.writer,
    psychologistTextModel: plan.models.psychologist,
    psychologistTextPromptVersion: plan.promptVersions.psychologistText,
    writerCriticModel: plan.models.writerCritic,
    writerCriticPromptVersion: plan.promptVersions.writerCritic,
    planIterationsCount: plan.planIterationsCount,
    planV1: plan.planV1,
    planFinal: plan.planFinal,
    psychologistPlanOutput: plan.psychologistPlanOutput,
    plotCriticOutput: plan.plotCriticOutput,
  }

  await db.insert(runSnapshots).values(snapshotRow)

  await db
    .update(stories)
    .set({
      planV1: plan.planV1,
      planFinal: plan.planFinal,
      planIterations: plan.planIterationsCount,
      plotterModel: plan.models.plotter,
      plotterPromptVersion: plan.promptVersions.plotter,
      plotCriticModel: plan.models.plotCritic,
      plotCriticPromptVersion: plan.promptVersions.plotCritic,
    })
    .where(eq(stories.id, storyId))
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
      .set({
        textV1: text.textV1,
        textV2: text.textV2,
        psychologistTextOutput: text.psychologistTextOutput,
        writerCriticOutput: text.writerCriticOutput,
      })
      .where(eq(runSnapshots.id, existing.id))
  }

  await db
    .update(stories)
    .set({
      textV1: text.textV1,
      textV2: text.textV2,
      writerModel: text.models.writer,
      writerPromptVersion: text.promptVersions.writer,
      writerCriticModel: text.models.writerCritic,
      writerCriticPromptVersion: text.promptVersions.writerCritic,
    })
    .where(eq(stories.id, storyId))
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

export interface PublicPipelineStatus {
  status: 'plan_running' | 'plan_ready' | 'text_running' | 'text_ready' | 'failed' | 'pending'
  phase: 'plan' | 'text' | null
}

export function toPublicStatus(internal: PipelineInternalStatus | undefined): PublicPipelineStatus {
  switch (internal) {
    case 'plan_running':
      return { status: 'plan_running', phase: 'plan' }
    case 'plan_ready':
      return { status: 'plan_ready', phase: 'plan' }
    case 'plan_failed':
      return { status: 'failed', phase: 'plan' }
    case 'text_running':
      return { status: 'text_running', phase: 'text' }
    case 'text_ready':
      return { status: 'text_ready', phase: 'text' }
    case 'text_failed':
      return { status: 'failed', phase: 'text' }
    default:
      return { status: 'pending', phase: null }
  }
}

const PIPELINE_STEP_NAMES = ['Plotter', 'Psychologist', 'PlotCritic', 'Writer', 'WriterCritic'] as const

router.get('/status/:storyId', async (req, res) => {
  try {
    const storyIdRaw = parseInt(req.params['storyId'] ?? '', 10)

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const internal = getPipelineStatus(storyIdRaw)
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
