import { Router } from 'express'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { storyIllustrationMarkers } from '@bedtime/core/db/schema'
import { validateMarkerLimit } from '@bedtime/core/story-illustrations/validate-marker-limit'
import { validate } from '../middleware/validate'

const router = Router()

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

const createMarkerSchema = z.object({
  text: z.string().min(1).max(2000, 'Слишком большой фрагмент текста (максимум 2000 символов)'),
  position_start: z.number().int().nonnegative(),
  position_end: z.number().int().nonnegative(),
})

router.post('/:id/illustration-markers', validate(createMarkerSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { text, position_start, position_end } = req.body as z.infer<typeof createMarkerSchema>

    const existing = await db
      .select({ id: storyIllustrationMarkers.id })
      .from(storyIllustrationMarkers)
      .where(eq(storyIllustrationMarkers.storyId, storyId))

    const limit = validateMarkerLimit({ currentMarkerCount: existing.length })

    if (!limit.allowed) {
      res.status(422).json({ error: limit.reason })
      return
    }

    const [marker] = await db
      .insert(storyIllustrationMarkers)
      .values({
        storyId,
        markedText: text,
        positionStart: position_start,
        positionEnd: position_end,
      })
      .returning()

    res.status(201).json(marker)
  } catch (err) {
    console.error('POST /stories/:id/illustration-markers failed:', err)
    res.status(500).json({ error: 'Failed to create illustration marker' })
  }
})

router.get('/:id/illustration-markers', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const result = await db
      .select()
      .from(storyIllustrationMarkers)
      .where(eq(storyIllustrationMarkers.storyId, storyId))

    res.json(result)
  } catch (err) {
    console.error('GET /stories/:id/illustration-markers failed:', err)
    res.status(500).json({ error: 'Failed to fetch illustration markers' })
  }
})

router.delete('/:id/illustration-markers/:markerId', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])
    const markerId = parseIntParam(req.params['markerId'])

    if (isNaN(storyId) || isNaN(markerId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    await db
      .delete(storyIllustrationMarkers)
      .where(and(eq(storyIllustrationMarkers.id, markerId), eq(storyIllustrationMarkers.storyId, storyId)))

    res.status(204).send()
  } catch (err) {
    console.error('DELETE /stories/:id/illustration-markers/:markerId failed:', err)
    res.status(500).json({ error: 'Failed to delete illustration marker' })
  }
})

export default router
