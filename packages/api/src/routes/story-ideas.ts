import { Router } from 'express'
import { z } from 'zod'
import { eq, and, or, count } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { storyIdeas, storyGroups, stories } from '@bedtime/core/db/schema'
import { runIdeaSuggester } from '@bedtime/core/pipeline/stages/idea-suggester'
import { validate } from '../middleware/validate'

const router = Router({ mergeParams: true })

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

const rejectSchema = z.object({
  rejectionReason: z.string().optional(),
})

const approveSchema = z.object({
  createStory: z.boolean().default(false),
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

router.post('/suggest', async (req, res) => {
  try {
    const p = req.params as Record<string, string | undefined>
    const universeId = parseIntParam(p['universeId'])

    if (isNaN(universeId)) {
      res.status(400).json({ error: 'Invalid universeId' })
      return
    }

    const [universe] = await db.select().from(storyGroups).where(eq(storyGroups.id, universeId))

    if (!universe) {
      res.status(404).json({ error: 'Universe not found' })
      return
    }

    const previousStories = await db
      .select({ title: stories.title, seed: stories.seed, planFinal: stories.planFinal })
      .from(stories)
      .where(and(eq(stories.groupId, universeId), or(eq(stories.status, 'read'), eq(stories.status, 'ready'))))

    const approvedIdeas = await db
      .select()
      .from(storyIdeas)
      .where(and(eq(storyIdeas.universeId, universeId), eq(storyIdeas.status, 'approved')))

    const rejectedIdeas = await db
      .select()
      .from(storyIdeas)
      .where(and(eq(storyIdeas.universeId, universeId), eq(storyIdeas.status, 'rejected')))

    const approvedIdeasSummary =
      approvedIdeas.length > 0
        ? approvedIdeas.map((idea) => `- ${idea.topic}: ${idea.seedText}`).join('\n')
        : undefined

    const rejectedIdeasSummary =
      rejectedIdeas.length > 0
        ? rejectedIdeas
            .map((idea) => `- ${idea.topic}: ${idea.seedText}${idea.rejectionReason ? ` (причина: ${idea.rejectionReason})` : ''}`)
            .join('\n')
        : undefined

    const output = await runIdeaSuggester({
      universeContext: universe.universeContext || '',
      universeStyleGuide: universe.styleGuide ? universe.styleGuide : undefined,
      previousStories: previousStories.map((s) => ({
        title: s.title || '(без названия)',
        seed: s.seed || '',
        ...(s.planFinal ? { planFinal: s.planFinal } : {}),
      })),
      approvedIdeasSummary,
      rejectedIdeasSummary,
      universeId,
    })

    const createdIds: number[] = []
    for (const topicGroup of output.topics) {
      for (const idea of topicGroup.ideas) {
        const [created] = await db
          .insert(storyIdeas)
          .values({
            universeId,
            topic: topicGroup.topic,
            seedText: idea.seed,
            rationale: idea.rationale,
            status: 'pending',
          })
          .returning({ id: storyIdeas.id })

        if (created) {
          createdIds.push(created.id)
        }
      }
    }

    res.json({ ideaCount: createdIds.length, createdIds })
  } catch (err) {
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

    let createdStoryId: number | null = null

    if (body.createStory) {
      const [newStory] = await db
        .insert(stories)
        .values({
          groupId: universeId,
          seed: idea.seedText,
          status: 'draft',
          source: 'agent',
          mode: 'auto',
        })
        .returning({ id: stories.id })

      if (newStory) {
        createdStoryId = newStory.id
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
