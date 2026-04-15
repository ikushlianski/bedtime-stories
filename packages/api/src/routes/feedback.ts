import { Router, Request } from 'express'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { feedback } from '@bedtime/core/db/schema'
import type { NewFeedback } from '@bedtime/core/db/types'
import { validate } from '../middleware/validate'

type StoryParams = { id: string }

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

const router = Router({ mergeParams: true })

const structuredFeedbackSchema = z.object({
  enjoyed: z.number().int().min(1).max(5),
  was_funny: z.boolean(),
  was_scary: z.boolean(),
  too_long: z.boolean(),
  favorite_moment: z.string(),
  favorite_character: z.string(),
  understood_moral: z.boolean(),
  want_again: z.boolean(),
  notes: z.string(),
}).nullable().optional()

const createFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  feedback_type: z.enum(['agent_run', 'retrospective']),
  structured_feedback: structuredFeedbackSchema,
})

router.post('/', validate(createFeedbackSchema), async (req: Request<StoryParams>, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { rating, comment, feedback_type, structured_feedback } = req.body as z.infer<typeof createFeedbackSchema>

    const newFeedback: NewFeedback = {
      storyId,
      rating,
      comment,
      feedbackType: feedback_type,
      structuredFeedback: structured_feedback ?? null,
    }

    const [created] = await db.insert(feedback).values(newFeedback).returning()

    res.status(201).json(created)
  } catch (err) {
    console.error('POST /stories/:id/feedback failed:', err)
    res.status(500).json({ error: 'Failed to create feedback' })
  }
})

router.get('/', async (req: Request<StoryParams>, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const result = await db
      .select()
      .from(feedback)
      .where(eq(feedback.storyId, storyId))
      .orderBy(desc(feedback.createdAt))

    res.json(result)
  } catch (err) {
    console.error('GET /stories/:id/feedback failed:', err)
    res.status(500).json({ error: 'Failed to fetch feedback' })
  }
})

export default router
