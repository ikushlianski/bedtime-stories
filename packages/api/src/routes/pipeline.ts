import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { runPipeline } from '@bedtime/core/pipeline/orchestrator'

// TODO: import { db } from '../db/client' when BE-1 is merged
// For now use a stub:
const db = null as unknown // will be replaced

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
    }).then((result) => {
      pipelineStatusMap.set(storyId, 'done')
      // DB: stub — insert run_snapshot here
      // shape: { storyId, models: result.models, promptVersions: result.promptVersions,
      //   planV1: result.planV1, planFinal: result.planFinal,
      //   planIterationsCount: result.planIterationsCount,
      //   psychologistPlanOutput: result.psychologistPlanOutput,
      //   plotCriticOutput: result.plotCriticOutput,
      //   textV1: result.textV1, textV2: result.textV2,
      //   psychologistTextOutput: result.psychologistTextOutput,
      //   writerCriticOutput: result.writerCriticOutput }
      void db
      void result
    }).catch(() => {
      pipelineStatusMap.set(storyId, 'error')
    })
  } catch {
    res.status(500).json({ error: 'Failed to start pipeline' })
  }
})

router.get('/status/:storyId', async (req, res) => {
  try {
    const storyIdRaw = parseInt(req.params['storyId'] ?? '', 10)

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const status = pipelineStatusMap.get(storyIdRaw) ?? 'unknown'

    res.json({ storyId: storyIdRaw, status })
  } catch {
    res.status(500).json({ error: 'Failed to get pipeline status' })
  }
})

export default router
