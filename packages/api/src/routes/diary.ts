import { Router } from 'express'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { childDiary } from '@bedtime/core/db/schema'
import { validate } from '../middleware/validate'

const router = Router()

export const createDiarySchema = z.object({
  content: z.string().min(1).max(2000, 'Слишком длинная запись (максимум 2000 символов)'),
})

router.get('/', async (_req, res) => {
  try {
    const entries = await db
      .select()
      .from(childDiary)
      .orderBy(desc(childDiary.createdAt))

    res.json(entries)
  } catch (err) {
    console.error('GET /api/diary failed:', err)
    res.status(500).json({ error: 'Failed to fetch diary entries' })
  }
})

router.post('/', validate(createDiarySchema), async (req, res) => {
  try {
    const { content } = req.body as z.infer<typeof createDiarySchema>

    const [created] = await db.insert(childDiary).values({ content }).returning()

    res.status(201).json(created)
  } catch (err) {
    console.error('POST /api/diary failed:', err)
    res.status(500).json({ error: 'Failed to create diary entry' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params['id'] ?? '', 10)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    await db.delete(childDiary).where(eq(childDiary.id, id))

    res.status(204).end()
  } catch (err) {
    console.error('DELETE /api/diary/:id failed:', err)
    res.status(500).json({ error: 'Failed to delete diary entry' })
  }
})

export default router
