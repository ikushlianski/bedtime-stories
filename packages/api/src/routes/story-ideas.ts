import { Router } from 'express'
import { z } from 'zod'
import { eq, and, count } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { storyIdeas, storyGroups, stories } from '@bedtime/core/db/schema'
import { generateStoryIdeasForUniverse, UniverseNotFoundError } from '@bedtime/core/pipeline/generate-story-ideas'
import { validate } from '../middleware/validate'
import { DEFAULT_STAGE_MODELS } from '@bedtime/core/pipeline/derivers/stage-defaults'
import { dispatchAutoPipeline } from './pipeline-dispatch'
import { setStoryUniverses } from './story-universe-links'

const router = Router({ mergeParams: true })

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

const rejectSchema = z.object({
  rejectionReason: z.string().optional(),
})

const suggestSchema = z.object({
  model: z.string().optional(),
})

const approveSchema = z.object({
  createStory: z.boolean().default(false),
  model: z.string().optional(),
})

router.get('/', async (req, res) => {
  try {
    const p = req.params as Record<string, string | undefined>
    const universeId = parseIntParam(p['universeId'])
    const status = (req.query.status as string) || 'pending'

    if (isNaN(universeId)) {
      res.status(400).json({ error: 'Invalid universeId' })
      return
    }

    const rows = await db
      .select()
      .from(storyIdeas)
      .where(
        status === 'all'
          ? eq(storyIdeas.universeId, universeId)
          : and(eq(storyIdeas.universeId, universeId), eq(storyIdeas.status, status as any)),
      )

    res.json(rows)
  } catch (err) {
    console.error('GET /universes/:universeId/ideas failed:', err)
    res.status(500).json({ error: 'Failed to fetch ideas' })
  }
})

router.post('/suggest', validate(suggestSchema), async (req, res) => {
  try {
    const p = req.params as Record<string, string | undefined>
    const universeId = parseIntParam(p['universeId'])

    if (isNaN(universeId)) {
      res.status(400).json({ error: 'Invalid universeId' })
      return
    }

    const body = req.body as z.infer<typeof suggestSchema>
    const result = await generateStoryIdeasForUniverse(universeId, body.model)

    res.json(result)
  } catch (err) {
    if (err instanceof UniverseNotFoundError) {
      res.status(404).json({ error: 'Universe not found' })
      return
    }

    console.error('POST /universes/:universeId/ideas/suggest failed:', err)
    res.status(500).json({ error: 'Failed to generate ideas' })
  }
})

router.post('/:ideaId/approve', validate(approveSchema), async (req, res) => {
  try {
    const p = req.params as Record<string, string | undefined>
    const universeId = parseIntParam(p['universeId'])
    const ideaId = parseIntParam(p['ideaId'])

    if (isNaN(universeId) || isNaN(ideaId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const [idea] = await db
      .select()
      .from(storyIdeas)
      .where(and(eq(storyIdeas.id, ideaId), eq(storyIdeas.universeId, universeId), eq(storyIdeas.status, 'pending')))

    if (!idea) {
      res.status(404).json({ error: 'Idea not found or already processed' })
      return
    }

    const body = req.body as z.infer<typeof approveSchema>
    const approvalModel = body.model || DEFAULT_STAGE_MODELS.plotter.model

    let createdStoryId: number | null = null

    if (body.createStory) {
      const [universe] = await db.select().from(storyGroups).where(eq(storyGroups.id, universeId))

      const [newStory] = await db
        .insert(stories)
        .values({
          groupId: universeId,
          seed: idea.seedText,
          status: 'draft',
          source: 'agent',
          mode: 'auto',
          plotterModel: approvalModel,
        })
        .returning({ id: stories.id })

      if (newStory) {
        createdStoryId = newStory.id

        await setStoryUniverses(newStory.id, [universeId])
        await dispatchAutoPipeline({
          storyId: newStory.id,
          seed: idea.seedText,
          universeSystemPrompt: universe?.systemPrompt ?? undefined,
          universeContext: universe?.universeContext ?? undefined,
          styleGuide: universe?.styleGuide ?? undefined,
          universeIds: [universeId],
        })
      }
    }

    await db
      .update(storyIdeas)
      .set({ status: 'approved', approvedAt: new Date() })
      .where(eq(storyIdeas.id, ideaId))

    res.json({ success: true, createdStoryId })
  } catch (err) {
    console.error('POST /universes/:universeId/ideas/:ideaId/approve failed:', err)
    res.status(500).json({ error: 'Failed to approve idea' })
  }
})

router.post('/:ideaId/reject', validate(rejectSchema), async (req, res) => {
  try {
    const p = req.params as Record<string, string | undefined>
    const universeId = parseIntParam(p['universeId'])
    const ideaId = parseIntParam(p['ideaId'])

    if (isNaN(universeId) || isNaN(ideaId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const [idea] = await db
      .select()
      .from(storyIdeas)
      .where(and(eq(storyIdeas.id, ideaId), eq(storyIdeas.universeId, universeId), eq(storyIdeas.status, 'pending')))

    if (!idea) {
      res.status(404).json({ error: 'Idea not found or already processed' })
      return
    }

    const body = req.body as z.infer<typeof rejectSchema>

    await db
      .update(storyIdeas)
      .set({ status: 'rejected', rejectionReason: body.rejectionReason || null, rejectedAt: new Date() })
      .where(eq(storyIdeas.id, ideaId))

    res.status(204).send()
  } catch (err) {
    console.error('POST /universes/:universeId/ideas/:ideaId/reject failed:', err)
    res.status(500).json({ error: 'Failed to reject idea' })
  }
})

export async function getPendingIdeasCount(universeId: number): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(storyIdeas)
    .where(and(eq(storyIdeas.universeId, universeId), eq(storyIdeas.status, 'pending')))

  return row?.count ?? 0
}

export default router
