import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { db } from '@bedtime/core/db/client'
import { stories, storyGroups } from '@bedtime/core/db/schema'
import type { NewStory } from '@bedtime/core/db/types'
import { validate } from '../middleware/validate'
import { runPlotterSeries } from '@bedtime/core/pipeline/stages/plotter-series'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer'
import { resolvePipelineModels } from './pipeline-defaults'

const router = Router()

const createSeriesSchema = z.object({
  seed: z.string().min(1).max(5000),
  groupId: z.number().int().positive().optional(),
})

router.post('/', validate(createSeriesSchema), async (req, res) => {
  try {
    const { seed, groupId } = req.body as z.infer<typeof createSeriesSchema>

    let universeSystemPrompt: string | undefined
    let universeContext: string | undefined
    let styleGuide: string | undefined

    if (groupId !== undefined) {
      const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, groupId))

      if (group) {
        universeSystemPrompt = group.systemPrompt
        universeContext = group.universeContext ?? undefined
        styleGuide = group.styleGuide ?? undefined
      }
    }

    const sashaContext = await synthesizeSashaContext()
    const models = await resolvePipelineModels(groupId ?? null, null)

    const plans = await runPlotterSeries({
      seed,
      model: models.plotter,
      ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
      ...(universeContext !== undefined ? { universeContext } : {}),
      ...(styleGuide !== undefined ? { styleGuide } : {}),
      ...(sashaContext !== null ? { sashaContext } : {}),
    })

    const seriesId = randomUUID()

    const inserts: NewStory[] = plans.map(({ outline, titleHint }) => ({
      title: titleHint || 'Без названия',
      seed,
      planV1: outline,
      planFinal: outline,
      status: 'draft',
      source: 'agent',
      mode: 'auto',
      plotterModel: models.plotter,
      plotterPromptVersion: 1,
      seriesId,
      ...(groupId !== undefined ? { groupId } : {}),
    }))

    const created = await db.insert(stories).values(inserts).returning()

    res.status(201).json({
      seriesId,
      stories: created.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        series_id: row.seriesId,
        created_at: row.createdAt,
      })),
    })
  } catch (err) {
    console.error('POST /stories/series failed:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create story series' })
  }
})

export default router
