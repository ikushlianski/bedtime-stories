import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { runPipeline } from '@bedtime/core/pipeline/orchestrator'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories } from '@bedtime/core/db/schema'
import type { NewRunSnapshot } from '@bedtime/core/db/types'

const router = Router()

const pipelineStatusMap = new Map<number, string>()

const defaultModels = {
  plotter: 'claude-sonnet-4-6',
  psychologist: 'claude-sonnet-4-6',
  plotCritic: 'claude-haiku-4-5-20251001',
  writer: 'claude-sonnet-4-6',
  writerCritic: 'claude-haiku-4-5-20251001',
}

const defaultPromptVersions = {
  plotter: 1,
  psychologistPlan: 1,
  psychologistText: 1,
  plotCritic: 1,
  writer: 1,
  writerCritic: 1,
}

const runPipelineSchema = z.object({
  storyId: z.number().int().positive(),
  seed: z.string().min(1),
})

router.post('/run', validate(runPipelineSchema), async (req, res) => {
  try {
    const { storyId, seed } = req.body as z.infer<typeof runPipelineSchema>

    pipelineStatusMap.set(storyId, 'running')

    res.json({ started: true, storyId })

    runPipeline({
      seed,
      storyId,
      models: defaultModels,
      promptVersions: defaultPromptVersions,
    }).then(async (result) => {
      pipelineStatusMap.set(storyId, 'done')

      const snapshotRow: NewRunSnapshot = {
        storyId,
        plotterModel: result.models.plotter,
        plotterPromptVersion: result.promptVersions.plotter,
        psychologistPlanModel: result.models.psychologist,
        psychologistPlanPromptVersion: result.promptVersions.psychologistPlan,
        plotCriticModel: result.models.plotCritic,
        plotCriticPromptVersion: result.promptVersions.plotCritic,
        writerModel: result.models.writer,
        writerPromptVersion: result.promptVersions.writer,
        psychologistTextModel: result.models.psychologist,
        psychologistTextPromptVersion: result.promptVersions.psychologistText,
        writerCriticModel: result.models.writerCritic,
        writerCriticPromptVersion: result.promptVersions.writerCritic,
        planIterationsCount: result.planIterationsCount,
        planV1: result.planV1,
        planFinal: result.planFinal,
        psychologistPlanOutput: result.psychologistPlanOutput,
        plotCriticOutput: result.plotCriticOutput,
        textV1: result.textV1,
        textV2: result.textV2,
        psychologistTextOutput: result.psychologistTextOutput,
        writerCriticOutput: result.writerCriticOutput,
      }

      try {
        await db.insert(runSnapshots).values(snapshotRow)

        await db
          .update(stories)
          .set({
            planV1: result.planV1,
            planFinal: result.planFinal,
            planIterations: result.planIterationsCount,
            textV1: result.textV1,
            textV2: result.textV2,
            plotterModel: result.models.plotter,
            plotterPromptVersion: result.promptVersions.plotter,
            plotCriticModel: result.models.plotCritic,
            plotCriticPromptVersion: result.promptVersions.plotCritic,
            writerModel: result.models.writer,
            writerPromptVersion: result.promptVersions.writer,
            writerCriticModel: result.models.writerCritic,
            writerCriticPromptVersion: result.promptVersions.writerCritic,
          })
          .where(eq(stories.id, storyId))
      } catch (dbError) {
        console.error('Failed to persist pipeline result to DB:', dbError)
      }
    }).catch((pipelineError) => {
      pipelineStatusMap.set(storyId, 'error')
      console.error(`Pipeline run failed for storyId=${storyId}:`, pipelineError)
    })
  } catch (err) {
    console.error('POST /pipeline/run failed:', err)
    res.status(500).json({ error: 'Failed to start pipeline' })
  }
})

const INTERNAL_TO_PUBLIC_STATUS: Record<string, 'running' | 'completed' | 'failed' | 'pending'> = {
  running: 'running',
  done: 'completed',
  error: 'failed',
  unknown: 'pending',
}

const PIPELINE_STEP_NAMES = ['Plotter', 'Psychologist', 'PlotCritic', 'Writer', 'WriterCritic'] as const

router.get('/status/:storyId', async (req, res) => {
  try {
    const storyIdRaw = parseInt(req.params['storyId'] ?? '', 10)

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const internalStatus = pipelineStatusMap.get(storyIdRaw) ?? 'unknown'
    const publicStatus = INTERNAL_TO_PUBLIC_STATUS[internalStatus] ?? 'pending'

    const stepStatus: 'pending' | 'running' | 'completed' | 'failed' =
      publicStatus === 'completed'
        ? 'completed'
        : publicStatus === 'failed'
          ? 'failed'
          : publicStatus === 'running'
            ? 'running'
            : 'pending'

    const steps = PIPELINE_STEP_NAMES.map((name) => ({
      name,
      status: stepStatus,
      agent: name,
    }))

    res.json({
      story_id: storyIdRaw,
      status: publicStatus,
      current_step: publicStatus === 'running' ? 'Plotter' : null,
      steps,
    })
  } catch (err) {
    console.error('GET /pipeline/status/:storyId failed:', err)
    res.status(500).json({ error: 'Failed to get pipeline status' })
  }
})

export default router
