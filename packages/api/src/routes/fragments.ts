import { Router } from 'express'
import { z } from 'zod'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { fragments, storyFragments, stories } from '@bedtime/core/db/schema'
import { validate } from '../middleware/validate'

const router = Router()

const createFragmentSchema = z.object({
  text: z.string().min(1).max(2000),
  universeId: z.number().int().positive().nullable().optional(),
  rank: z.number().int().optional(),
})

const updateFragmentSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  universeId: z.number().int().positive().nullable().optional(),
  rank: z.number().int().optional(),
})

const usedCount = sql<number>`(
  select count(distinct ${storyFragments.storyId})::int from ${storyFragments}
  join ${stories} on ${stories.id} = ${storyFragments.storyId}
  where ${storyFragments.fragmentId} = ${fragments.id}
    and ${stories.status} in ('proofreading', 'ready', 'read')
)`

router.get('/', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: fragments.id,
        text: fragments.text,
        universeId: fragments.universeId,
        rank: fragments.rank,
        usedCount,
        createdAt: fragments.createdAt,
        updatedAt: fragments.updatedAt,
      })
      .from(fragments)
      .orderBy(desc(fragments.rank), desc(fragments.createdAt))

    res.json(rows)
  } catch (err) {
    console.error('GET /api/fragments failed:', err)
    res.status(500).json({ error: 'Failed to fetch fragments' })
  }
})

router.post('/', validate(createFragmentSchema), async (req, res) => {
  try {
    const { text, universeId, rank } = req.body as z.infer<typeof createFragmentSchema>

    const [created] = await db
      .insert(fragments)
      .values({
        text,
        universeId: universeId ?? null,
        ...(rank !== undefined ? { rank } : {}),
      })
      .returning()

    res.status(201).json({ ...created, usedCount: 0 })
  } catch (err) {
    console.error('POST /api/fragments failed:', err)
    res.status(500).json({ error: 'Failed to create fragment' })
  }
})

router.patch('/:id', validate(updateFragmentSchema), async (req, res) => {
  try {
    const rawId = req.params['id']
    const id = parseInt(Array.isArray(rawId) ? '' : rawId ?? '', 10)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const { text, universeId, rank } = req.body as z.infer<typeof updateFragmentSchema>

    const [updated] = await db
      .update(fragments)
      .set({
        ...(text !== undefined ? { text } : {}),
        ...(universeId !== undefined ? { universeId } : {}),
        ...(rank !== undefined ? { rank } : {}),
        updatedAt: new Date(),
      })
      .where(eq(fragments.id, id))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Fragment not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    console.error('PATCH /api/fragments/:id failed:', err)
    res.status(500).json({ error: 'Failed to update fragment' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params['id'] ?? '', 10)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    await db.delete(storyFragments).where(eq(storyFragments.fragmentId, id))
    await db.delete(fragments).where(eq(fragments.id, id))

    res.status(204).end()
  } catch (err) {
    console.error('DELETE /api/fragments/:id failed:', err)
    res.status(500).json({ error: 'Failed to delete fragment' })
  }
})

export default router
