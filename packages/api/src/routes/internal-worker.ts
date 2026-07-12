import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories } from '@bedtime/core/db/schema'
import { runAutoPipeline } from './pipeline-auto-trigger'
import { analyzeStoryAndLearn } from './story-analysis'

const router = Router()

const pipelineTaskSchema = z.object({
  storyId: z.number().int().positive(),
  seed: z.string().min(1),
  universeSystemPrompt: z.string().optional(),
  universeContext: z.string().optional(),
  styleGuide: z.string().optional(),
  universeId: z.number().int().nullable().optional(),
})

const analyzeTaskSchema = z.object({
  storyId: z.number().int().positive(),
})

router.use((req, res, next) => {
  const secret = process.env['PIPELINE_WORKER_SECRET']
  const incoming = req.headers['x-pipeline-secret']

  if (!secret || incoming !== secret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
})

router.post('/pipeline', async (req, res) => {
  const parsed = pipelineTaskSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid task payload' })
    return
  }

  const params = parsed.data

  try {
    const [existing] = await db
      .select({ textV1: stories.textV1 })
      .from(stories)
      .where(eq(stories.id, params.storyId))

    if (existing?.textV1) {
      res.json({ ok: true, skipped: 'already_generated' })
      return
    }

    await runAutoPipeline(params)
    res.json({ ok: true })
  } catch (err) {
    console.error(`[worker] pipeline task failed for storyId=${params.storyId}:`, err)
    res.status(500).json({ error: 'Pipeline task failed' })
  }
})

router.post('/analyze', async (req, res) => {
  const parsed = analyzeTaskSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid task payload' })
    return
  }

  try {
    await analyzeStoryAndLearn(parsed.data.storyId)
    res.json({ ok: true })
  } catch (err) {
    console.error(`[worker] analyze task failed for storyId=${parsed.data.storyId}:`, err)
    res.status(500).json({ error: 'Analyze task failed' })
  }
})

export default router
