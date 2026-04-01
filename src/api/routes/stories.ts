import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'

// TODO: import { db } from '../db/client' when BE-1 is merged
// For now use a stub:
const db = null as any // will be replaced

const router = Router()

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
    // DB: stub — replace with real db calls after merge
    const { seed } = req.body as z.infer<typeof createStorySchema>
    const title = seed.trim().slice(0, 60)
    const story = await db.insert('stories').values({ seed, title, status: 'draft' }).returning()

    res.status(201).json(story)
  } catch {
    res.status(500).json({ error: 'Failed to create story' })
  }
})

router.get('/', async (req, res) => {
  try {
    // DB: stub — replace with real db calls after merge
    const { status } = req.query

    if (status !== undefined && typeof status !== 'string') {
      res.status(400).json({ error: 'Invalid status filter' })
      return
    }

    const stories = await db.select().from('stories').orderBy('createdAt', 'desc')

    res.json(stories)
  } catch {
    res.status(500).json({ error: 'Failed to fetch stories' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    // DB: stub — replace with real db calls after merge
    const { id } = req.params
    const story = await db.select().from('stories').where({ id }).first()

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
    // DB: stub — replace with real db calls after merge
    const { id } = req.params
    const { status } = req.body as z.infer<typeof updateStatusSchema>
    const story = await db.update('stories').set({ status }).where({ id }).returning()

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
    // DB: stub — replace with real db calls after merge
    const { id } = req.params
    const { approved } = req.body as z.infer<typeof approvePlanSchema>
    const updateData = approved ? { status: 'ready' } : {}
    const story = await db.update('stories').set(updateData).where({ id }).returning()

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
    // DB: stub — replace with real db calls after merge
    const { id } = req.params
    const { approved } = req.body as z.infer<typeof approveTextSchema>
    const updateData = approved ? { status: 'ready' } : {}
    const story = await db.update('stories').set(updateData).where({ id }).returning()

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
    // DB: stub — insert annotation
    const storyId = parseInt(req.params['id'] ?? '', 10)

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { type, selected_text, position_start, position_end } = req.body as z.infer<typeof createAnnotationSchema>

    const annotation = {
      id: 0,
      storyId,
      type,
      selectedText: selected_text,
      positionStart: position_start,
      positionEnd: position_end,
      createdAt: new Date(),
    }

    res.status(201).json(annotation)
  } catch {
    res.status(500).json({ error: 'Failed to create annotation' })
  }
})

router.get('/:id/annotations', async (req, res) => {
  try {
    // DB: stub — returns annotations[]
    void req.params['id']

    res.json([])
  } catch {
    res.status(500).json({ error: 'Failed to fetch annotations' })
  }
})

export default router
