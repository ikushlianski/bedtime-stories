import { Router } from 'express'
import { z } from 'zod'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { words, storyWords } from '@bedtime/core/db/schema'
import { validate } from '../middleware/validate'

const router = Router()

const createWordSchema = z.object({
  word: z.string().min(1).max(200),
  hint: z.string().max(2000).nullable().optional(),
  universeId: z.number().int().positive().nullable().optional(),
  rank: z.number().int().optional(),
})

const updateWordSchema = z.object({
  word: z.string().min(1).max(200).optional(),
  hint: z.string().max(2000).nullable().optional(),
  universeId: z.number().int().positive().nullable().optional(),
  rank: z.number().int().optional(),
})

const usedCount = sql<number>`(
  select count(distinct sw.story_id)::int
  from story_words sw
  join stories s on s.id = sw.story_id
  where sw.word_id = ${words}.id
    and s.status in ('proofreading', 'ready', 'read')
)`

router.get('/', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: words.id,
        word: words.word,
        hint: words.hint,
        universeId: words.universeId,
        rank: words.rank,
        usedCount,
        createdAt: words.createdAt,
        updatedAt: words.updatedAt,
      })
      .from(words)
      .orderBy(desc(words.rank), desc(words.createdAt))

    res.json(rows)
  } catch (err) {
    console.error('GET /api/words failed:', err)
    res.status(500).json({ error: 'Failed to fetch words' })
  }
})

router.post('/', validate(createWordSchema), async (req, res) => {
  try {
    const { word, hint, universeId, rank } = req.body as z.infer<typeof createWordSchema>

    const [created] = await db
      .insert(words)
      .values({
        word,
        hint: hint ?? null,
        universeId: universeId ?? null,
        ...(rank !== undefined ? { rank } : {}),
      })
      .returning()

    res.status(201).json({ ...created, usedCount: 0 })
  } catch (err) {
    console.error('POST /api/words failed:', err)
    res.status(500).json({ error: 'Failed to create word' })
  }
})

router.patch('/:id', validate(updateWordSchema), async (req, res) => {
  try {
    const rawId = req.params['id']
    const id = parseInt(Array.isArray(rawId) ? '' : rawId ?? '', 10)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const { word, hint, universeId, rank } = req.body as z.infer<typeof updateWordSchema>

    const [updated] = await db
      .update(words)
      .set({
        ...(word !== undefined ? { word } : {}),
        ...(hint !== undefined ? { hint } : {}),
        ...(universeId !== undefined ? { universeId } : {}),
        ...(rank !== undefined ? { rank } : {}),
        updatedAt: new Date(),
      })
      .where(eq(words.id, id))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Word not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    console.error('PATCH /api/words/:id failed:', err)
    res.status(500).json({ error: 'Failed to update word' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params['id'] ?? '', 10)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    await db.delete(storyWords).where(eq(storyWords.wordId, id))
    await db.delete(words).where(eq(words.id, id))

    res.status(204).end()
  } catch (err) {
    console.error('DELETE /api/words/:id failed:', err)
    res.status(500).json({ error: 'Failed to delete word' })
  }
})

export default router
