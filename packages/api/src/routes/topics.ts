import { Router } from 'express'
import { z } from 'zod'
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { topics, storyTopics, stories, storyGroups } from '@bedtime/core/db/schema'
import { runTopicCombiner, type TopicPoolItem } from '@bedtime/core/pipeline/stages/topic-combiner'
import { filterValidCombos, isValidComboSelection, synthesizeSeedFromTopics } from '@bedtime/core/pipeline/topic-derivers'
import { DEFAULT_STAGE_MODELS } from '@bedtime/core/pipeline/derivers/stage-defaults'
import { validate } from '../middleware/validate'
import { loadUniverseContext } from './load-universe-context'
import { triggerAutoPipeline } from './pipeline-auto-trigger'

const router = Router()

const createTopicSchema = z.object({
  title: z.string().min(1).max(200),
  note: z.string().max(2000).nullable().optional(),
  universeId: z.number().int().positive().nullable().optional(),
  rank: z.number().int().optional(),
})

const updateTopicSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  note: z.string().max(2000).nullable().optional(),
  universeId: z.number().int().positive().nullable().optional(),
  rank: z.number().int().optional(),
})

const suggestCombosSchema = z.object({
  universeId: z.number().int().positive().nullable().optional(),
  model: z.string().optional(),
})

const generateSchema = z.object({
  topicIds: z.array(z.number().int().positive()).min(2).max(3),
  universeId: z.number().int().positive(),
  seed: z.string().min(1).optional(),
  model: z.string().optional(),
})

const usedCount = sql<number>`(
  select count(distinct st.story_id)::int
  from story_topics st
  where st.topic_id = ${topics}.id
)`

router.get('/', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: topics.id,
        title: topics.title,
        note: topics.note,
        universeId: topics.universeId,
        rank: topics.rank,
        usedCount,
        createdAt: topics.createdAt,
        updatedAt: topics.updatedAt,
      })
      .from(topics)
      .orderBy(desc(topics.rank), desc(topics.createdAt))

    res.json(rows)
  } catch (err) {
    console.error('GET /api/topics failed:', err)
    res.status(500).json({ error: 'Failed to fetch topics' })
  }
})

router.post('/', validate(createTopicSchema), async (req, res) => {
  try {
    const { title, note, universeId, rank } = req.body as z.infer<typeof createTopicSchema>

    const [created] = await db
      .insert(topics)
      .values({
        title,
        note: note ?? null,
        universeId: universeId ?? null,
        ...(rank !== undefined ? { rank } : {}),
      })
      .returning()

    res.status(201).json({ ...created, usedCount: 0 })
  } catch (err) {
    console.error('POST /api/topics failed:', err)
    res.status(500).json({ error: 'Failed to create topic' })
  }
})

router.patch('/:id', validate(updateTopicSchema), async (req, res) => {
  try {
    const rawId = req.params['id']
    const id = parseInt(Array.isArray(rawId) ? '' : rawId ?? '', 10)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const { title, note, universeId, rank } = req.body as z.infer<typeof updateTopicSchema>

    const [updated] = await db
      .update(topics)
      .set({
        ...(title !== undefined ? { title } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(universeId !== undefined ? { universeId } : {}),
        ...(rank !== undefined ? { rank } : {}),
        updatedAt: new Date(),
      })
      .where(eq(topics.id, id))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Topic not found' })
      return
    }

    res.json(updated)
  } catch (err) {
    console.error('PATCH /api/topics/:id failed:', err)
    res.status(500).json({ error: 'Failed to update topic' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const rawId = req.params['id']
    const id = parseInt(Array.isArray(rawId) ? '' : rawId ?? '', 10)

    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    await db.delete(storyTopics).where(eq(storyTopics.topicId, id))
    await db.delete(topics).where(eq(topics.id, id))

    res.status(204).end()
  } catch (err) {
    console.error('DELETE /api/topics/:id failed:', err)
    res.status(500).json({ error: 'Failed to delete topic' })
  }
})

router.post('/suggest-combos', validate(suggestCombosSchema), async (req, res) => {
  try {
    const { universeId, model } = req.body as z.infer<typeof suggestCombosSchema>

    const pool = await db
      .select({
        id: topics.id,
        title: topics.title,
        note: topics.note,
        usedCount,
      })
      .from(topics)
      .orderBy(desc(topics.rank), desc(topics.createdAt))

    if (pool.length < 2) {
      res.status(422).json({ error: 'Need at least 2 topics to suggest a combo' })
      return
    }

    let universeContext: string | undefined
    let universeStyleGuide: string | undefined

    if (universeId) {
      const ctx = await loadUniverseContext(universeId)
      universeContext = ctx.universeContext
      universeStyleGuide = ctx.styleGuide
    }

    const combinerModel = model || DEFAULT_STAGE_MODELS.ideaSuggester.model
    const poolItems: TopicPoolItem[] = pool.map((t) => ({ id: t.id, title: t.title, note: t.note, usedCount: t.usedCount }))

    const output = await runTopicCombiner({
      topics: poolItems,
      universeContext,
      universeStyleGuide,
      model: combinerModel,
    })

    const combos = filterValidCombos(output.combos, pool.map((t) => t.id))

    res.json({ combos })
  } catch (err) {
    console.error('POST /api/topics/suggest-combos failed:', err)
    res.status(500).json({ error: 'Failed to suggest combos' })
  }
})

router.post('/generate', validate(generateSchema), async (req, res) => {
  try {
    const { topicIds, universeId, seed, model } = req.body as z.infer<typeof generateSchema>

    const selected = await db.select().from(topics).where(inArray(topics.id, topicIds))

    if (!isValidComboSelection(selected.map((t) => t.id), topicIds)) {
      res.status(422).json({ error: 'Selection must be 2-3 existing topics' })
      return
    }

    const [universe] = await db.select().from(storyGroups).where(eq(storyGroups.id, universeId))

    if (!universe) {
      res.status(404).json({ error: 'Universe not found' })
      return
    }

    const orderedTopics = topicIds
      .map((id) => selected.find((t) => t.id === id))
      .filter((t): t is (typeof selected)[number] => t !== undefined)

    const storySeed = seed ?? synthesizeSeedFromTopics(orderedTopics.map((t) => ({ title: t.title, note: t.note })))
    const plotterModel = model || DEFAULT_STAGE_MODELS.plotter.model

    const [newStory] = await db
      .insert(stories)
      .values({
        groupId: universeId,
        seed: storySeed,
        status: 'draft',
        source: 'agent',
        mode: 'auto',
        plotterModel,
      })
      .returning({ id: stories.id })

    if (!newStory) {
      res.status(500).json({ error: 'Failed to create story' })
      return
    }

    await db
      .insert(storyTopics)
      .values(orderedTopics.map((t) => ({ storyId: newStory.id, topicId: t.id })))
      .onConflictDoNothing()

    triggerAutoPipeline(newStory.id, storySeed, undefined, undefined, undefined, universeId)

    res.status(201).json({ storyId: newStory.id })
  } catch (err) {
    console.error('POST /api/topics/generate failed:', err)
    res.status(500).json({ error: 'Failed to generate story from topics' })
  }
})

export default router
