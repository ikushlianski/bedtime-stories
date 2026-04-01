import { Router } from 'express'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, annotations } from '@bedtime/core/db/schema'
import type { NewStory, NewAnnotation } from '@bedtime/core/db/types'
import { validate } from '../middleware/validate'

const router = Router()

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

const createStorySchema = z.object({
  seed: z.string().min(1).max(5000),
})

const updateStatusSchema = z.object({
  status: z.enum(['draft', 'ready', 'read', 'archived']),
})

const approvePlanSchema = z.object({
  approved: z.boolean(),
})

const approveTextSchema = z.object({
  approved: z.boolean(),
})

const createAnnotationSchema = z.object({
  type: z.enum(['sasha_reaction', 'my_note']),
  selected_text: z.string().min(1),
  position_start: z.number().int().nonnegative(),
  position_end: z.number().int().nonnegative(),
})

router.post('/', validate(createStorySchema), async (req, res) => {
  try {
    const { seed } = req.body as z.infer<typeof createStorySchema>
    const title = seed.trim().slice(0, 60)

    const newStory: NewStory = { seed, title, status: 'draft', source: 'agent' }
    const [story] = await db.insert(stories).values(newStory).returning()

    res.status(201).json(story)
  } catch {
    res.status(500).json({ error: 'Failed to create story' })
  }
})

router.get('/', async (req, res) => {
  try {
    const { status } = req.query

    if (status !== undefined && typeof status !== 'string') {
      res.status(400).json({ error: 'Invalid status filter' })
      return
    }

    const result = status
      ? await db
          .select()
          .from(stories)
          .where(eq(stories.status, status as 'draft' | 'ready' | 'read' | 'archived'))
          .orderBy(desc(stories.createdAt))
      : await db.select().from(stories).orderBy(desc(stories.createdAt))

    res.json(result)
  } catch {
    res.status(500).json({ error: 'Failed to fetch stories' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const [story] = await db.select().from(stories).where(eq(stories.id, storyId))

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    res.json(story)
  } catch {
    res.status(500).json({ error: 'Failed to fetch story' })
  }
})

router.patch('/:id/status', validate(updateStatusSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { status } = req.body as z.infer<typeof updateStatusSchema>
    const [story] = await db
      .update(stories)
      .set({ status })
      .where(eq(stories.id, storyId))
      .returning()

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    res.json(story)
  } catch {
    res.status(500).json({ error: 'Failed to update story status' })
  }
})

router.post('/:id/approve-plan', validate(approvePlanSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { approved } = req.body as z.infer<typeof approvePlanSchema>

    if (!approved) {
      const [existing] = await db.select().from(stories).where(eq(stories.id, storyId))

      if (!existing) {
        res.status(404).json({ error: 'Story not found' })
        return
      }

      res.json(existing)
      return
    }

    const [story] = await db
      .update(stories)
      .set({ status: 'ready' })
      .where(eq(stories.id, storyId))
      .returning()

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    res.json(story)
  } catch {
    res.status(500).json({ error: 'Failed to approve plan' })
  }
})

router.post('/:id/approve-text', validate(approveTextSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { approved } = req.body as z.infer<typeof approveTextSchema>

    if (!approved) {
      const [existing] = await db.select().from(stories).where(eq(stories.id, storyId))

      if (!existing) {
        res.status(404).json({ error: 'Story not found' })
        return
      }

      res.json(existing)
      return
    }

    const [story] = await db
      .update(stories)
      .set({ status: 'ready' })
      .where(eq(stories.id, storyId))
      .returning()

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    res.json(story)
  } catch {
    res.status(500).json({ error: 'Failed to approve text' })
  }
})

router.post('/:id/annotations', validate(createAnnotationSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { type, selected_text, position_start, position_end } = req.body as z.infer<
      typeof createAnnotationSchema
    >

    const newAnnotation: NewAnnotation = {
      storyId,
      type,
      selectedText: selected_text,
      positionStart: position_start,
      positionEnd: position_end,
    }

    const [annotation] = await db.insert(annotations).values(newAnnotation).returning()

    res.status(201).json(annotation)
  } catch {
    res.status(500).json({ error: 'Failed to create annotation' })
  }
})

router.get('/:id/annotations', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const result = await db
      .select()
      .from(annotations)
      .where(eq(annotations.storyId, storyId))

    res.json(result)
  } catch {
    res.status(500).json({ error: 'Failed to fetch annotations' })
  }
})

export default router
