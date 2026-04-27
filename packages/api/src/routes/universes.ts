import { Router } from 'express'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { storyGroups, stories, universeCharacters } from '@bedtime/core/db/schema'
import type { StoryGroup, NewStoryGroup } from '@bedtime/core/db/types'
import { validate } from '../middleware/validate'
import { getPendingSuggestionsCount } from './universe-suggestions'

const router = Router()

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

const createGroupSchema = z.object({
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  description: z.string().optional(),
  agentOverrides: z.record(z.string(), z.string()).optional(),
})

const updateGroupSchema = z.object({
  name: z.string().min(1).optional(),
  systemPrompt: z.string().min(1).optional(),
  description: z.string().optional(),
  universeContext: z.string().optional(),
  styleGuide: z.string().nullable().optional(),
  styleGuideWorks: z.string().nullable().optional(),
  styleGuideDoesntWork: z.string().nullable().optional(),
  styleGuideTechniques: z.string().nullable().optional(),
  styleGuideMinimize: z.string().nullable().optional(),
  agentOverrides: z.record(z.string(), z.string()).optional(),
})

const createCharacterSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

const updateCharacterSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

async function toPublic(row: StoryGroup) {
  const [characters, pendingSuggestionsCount] = await Promise.all([
    db.select().from(universeCharacters).where(eq(universeCharacters.universeId, row.id)),
    getPendingSuggestionsCount(row.id),
  ])

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    systemPrompt: row.systemPrompt,
    universeContext: row.universeContext ?? null,
    styleGuide: row.styleGuide ?? null,
    styleGuideWorks: row.styleGuideWorks ?? null,
    styleGuideDoesntWork: row.styleGuideDoesntWork ?? null,
    styleGuideTechniques: row.styleGuideTechniques ?? null,
    styleGuideMinimize: row.styleGuideMinimize ?? null,
    agentOverrides: row.agentOverrides,
    createdAt: row.createdAt,
    characters,
    pendingSuggestionsCount,
  }
}

router.get('/', async (_req, res) => {
  try {
    const rows = await db.select().from(storyGroups)

    const results = await Promise.all(rows.map((r) => toPublic(r as StoryGroup)))

    res.json(results)
  } catch (err) {
    console.error('GET /universes failed:', err)
    res.status(500).json({ error: 'Failed to fetch universes' })
  }
})

router.post('/', validate(createGroupSchema), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof createGroupSchema>

    const newGroup: NewStoryGroup = {
      name: body.name,
      systemPrompt: body.systemPrompt,
      description: body.description ?? '',
      agentOverrides: body.agentOverrides ?? {},
    }

    const [created] = await db.insert(storyGroups).values(newGroup).returning()

    res.status(201).json(await toPublic(created as StoryGroup))
  } catch (err) {
    console.error('POST /universes failed:', err)
    res.status(500).json({ error: 'Failed to create universe' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const id = parseIntParam(req.params['id'])

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const [row] = await db.select().from(storyGroups).where(eq(storyGroups.id, id))

    if (!row) {
      res.status(404).json({ error: 'Universe not found' })
      return
    }

    res.json(await toPublic(row as StoryGroup))
  } catch (err) {
    console.error('GET /universes/:id failed:', err)
    res.status(500).json({ error: 'Failed to fetch universe' })
  }
})

router.patch('/:id', validate(updateGroupSchema), async (req, res) => {
  try {
    const id = parseIntParam(req.params['id'])

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const body = req.body as z.infer<typeof updateGroupSchema>

    const [updated] = await db
      .update(storyGroups)
      .set(body)
      .where(eq(storyGroups.id, id))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Universe not found' })
      return
    }

    res.json(await toPublic(updated as StoryGroup))
  } catch (err) {
    console.error('PATCH /universes/:id failed:', err)
    res.status(500).json({ error: 'Failed to update universe' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const id = parseIntParam(req.params['id'])

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const [existing] = await db.select().from(storyGroups).where(eq(storyGroups.id, id))

    if (!existing) {
      res.status(404).json({ error: 'Universe not found' })
      return
    }

    const [referencingStory] = await db
      .select({ id: stories.id })
      .from(stories)
      .where(eq(stories.groupId, id))
      .limit(1)

    if (referencingStory) {
      res.status(409).json({ error: 'Universe is referenced by one or more stories' })
      return
    }

    await db.delete(storyGroups).where(eq(storyGroups.id, id))

    res.status(204).send()
  } catch (err) {
    console.error('DELETE /universes/:id failed:', err)
    res.status(500).json({ error: 'Failed to delete universe' })
  }
})

router.get('/:id/characters', async (req, res) => {
  try {
    const id = parseIntParam(req.params['id'])

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const chars = await db
      .select()
      .from(universeCharacters)
      .where(eq(universeCharacters.universeId, id))

    res.json(chars)
  } catch (err) {
    console.error('GET /universes/:id/characters failed:', err)
    res.status(500).json({ error: 'Failed to fetch characters' })
  }
})

router.post('/:id/characters', validate(createCharacterSchema), async (req, res) => {
  try {
    const id = parseIntParam(req.params['id'])

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const body = req.body as z.infer<typeof createCharacterSchema>

    const [created] = await db
      .insert(universeCharacters)
      .values({ universeId: id, name: body.name, description: body.description ?? '' })
      .returning()

    res.status(201).json(created)
  } catch (err) {
    console.error('POST /universes/:id/characters failed:', err)
    res.status(500).json({ error: 'Failed to create character' })
  }
})

router.patch('/:id/characters/:charId', validate(updateCharacterSchema), async (req, res) => {
  try {
    const id = parseIntParam(req.params['id'])
    const charId = parseIntParam(req.params['charId'])

    if (isNaN(id) || isNaN(charId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const body = req.body as z.infer<typeof updateCharacterSchema>

    const [updated] = await db
      .update(universeCharacters)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(universeCharacters.id, charId), eq(universeCharacters.universeId, id)))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Character not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    console.error('PATCH /universes/:id/characters/:charId failed:', err)
    res.status(500).json({ error: 'Failed to update character' })
  }
})

router.delete('/:id/characters/:charId', async (req, res) => {
  try {
    const id = parseIntParam(req.params['id'])
    const charId = parseIntParam(req.params['charId'])

    if (isNaN(id) || isNaN(charId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    await db
      .delete(universeCharacters)
      .where(and(eq(universeCharacters.id, charId), eq(universeCharacters.universeId, id)))

    res.status(204).send()
  } catch (err) {
    console.error('DELETE /universes/:id/characters/:charId failed:', err)
    res.status(500).json({ error: 'Failed to delete character' })
  }
})

export default router
