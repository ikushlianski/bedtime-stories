import { Router } from 'express'
import { z } from 'zod'
import { eq, and, count } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { universeSuggestions, universeCharacters } from '@bedtime/core/db/schema'
import { appendFactToDescription } from '@bedtime/core/pipeline/derivers/universe-facts'
import { validate } from '../middleware/validate'

const router = Router({ mergeParams: true })

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

const approveSchema = z.discriminatedUnion('target', [
  z.object({ target: z.literal('character'), characterName: z.string().min(1) }),
  z.object({ target: z.literal('new_character'), characterName: z.string().min(1) }),
  z.object({ target: z.literal('description') }),
])

router.get('/', async (req, res) => {
  try {
    const p = req.params as Record<string, string | undefined>
    const universeId = parseIntParam(p['universeId'])

    if (isNaN(universeId)) {
      res.status(400).json({ error: 'Invalid universeId' })
      return
    }

    const rows = await db
      .select()
      .from(universeSuggestions)
      .where(and(eq(universeSuggestions.universeId, universeId), eq(universeSuggestions.status, 'pending')))

    res.json(rows)
  } catch (err) {
    console.error('GET /universes/:id/suggestions failed:', err)
    res.status(500).json({ error: 'Failed to fetch suggestions' })
  }
})

router.post('/:suggestionId/approve', validate(approveSchema), async (req, res) => {
  try {
    const p = req.params as Record<string, string | undefined>
    const universeId = parseIntParam(p['universeId'])
    const suggestionId = parseIntParam(p['suggestionId'])

    if (isNaN(universeId) || isNaN(suggestionId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const [suggestion] = await db
      .select()
      .from(universeSuggestions)
      .where(and(eq(universeSuggestions.id, suggestionId), eq(universeSuggestions.universeId, universeId), eq(universeSuggestions.status, 'pending')))

    if (!suggestion) {
      res.status(404).json({ error: 'Suggestion not found or already processed' })
      return
    }

    const body = req.body as z.infer<typeof approveSchema>

    if (body.target === 'character' || body.target === 'new_character') {
      const { characterName } = body
      const [existing] = await db
        .select()
        .from(universeCharacters)
        .where(and(eq(universeCharacters.universeId, universeId), eq(universeCharacters.name, characterName)))

      if (existing) {
        const newDescription = appendFactToDescription(existing.description, suggestion.factText)

        await db
          .update(universeCharacters)
          .set({ description: newDescription })
          .where(eq(universeCharacters.id, existing.id))
      } else {
        await db.insert(universeCharacters).values({
          universeId,
          name: characterName,
          description: `- ${suggestion.factText}`,
        })
      }
    }

    await db
      .update(universeSuggestions)
      .set({ status: 'approved' })
      .where(eq(universeSuggestions.id, suggestionId))

    res.status(204).send()
  } catch (err) {
    console.error('POST /universes/:id/suggestions/:id/approve failed:', err)
    res.status(500).json({ error: 'Failed to approve suggestion' })
  }
})

router.post('/:suggestionId/reject', async (req, res) => {
  try {
    const p = req.params as Record<string, string | undefined>
    const universeId = parseIntParam(p['universeId'])
    const suggestionId = parseIntParam(p['suggestionId'])

    if (isNaN(universeId) || isNaN(suggestionId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const [suggestion] = await db
      .select()
      .from(universeSuggestions)
      .where(and(eq(universeSuggestions.id, suggestionId), eq(universeSuggestions.universeId, universeId), eq(universeSuggestions.status, 'pending')))

    if (!suggestion) {
      res.status(404).json({ error: 'Suggestion not found or already processed' })
      return
    }

    await db
      .update(universeSuggestions)
      .set({ status: 'rejected' })
      .where(eq(universeSuggestions.id, suggestionId))

    res.status(204).send()
  } catch (err) {
    console.error('POST /universes/:id/suggestions/:id/reject failed:', err)
    res.status(500).json({ error: 'Failed to reject suggestion' })
  }
})

export async function getPendingSuggestionsCount(universeId: number): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(universeSuggestions)
    .where(and(eq(universeSuggestions.universeId, universeId), eq(universeSuggestions.status, 'pending')))

  return row?.count ?? 0
}

export default router
