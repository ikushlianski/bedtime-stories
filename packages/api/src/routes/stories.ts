import { Router } from 'express'
import { z } from 'zod'
import { eq, desc, and, sql } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, annotations, feedback, runSnapshots, storyGroups, planQuestions, planConversations, childDiary, parentReviews, childReactions, universeCharacters, universeSuggestions, storyReadings, modelCalls, storyTextVersions } from '@bedtime/core/db/schema'
import { deriveStoryCostBreakdown } from '@bedtime/core/cost/aggregations/derive-story-cost-breakdown'
import type { Story, NewStory, NewAnnotation, ParentReview, ChildReaction } from '@bedtime/core/db/types'
import { validate } from '../middleware/validate'
import { triggerTextPhase, getPipelineStatus } from './pipeline'
import { triggerPlanRedo } from './pipeline-plan-redo'
import { triggerTextCritique, triggerTextRewrite } from './pipeline-text-critique'
import { decideApprovePlan } from './approve-plan-decision'
import textVersionsRouter from './text-versions'
import { createStorySchema, resolveCreateStoryMode } from './create-story-schema'
import { runStoryAnalyzer } from '@bedtime/core/pipeline/stages/story-analyzer'
import { updateStyleGuide } from '@bedtime/core/pipeline/style-guide-updater'
import { runUniverseFactExtractor } from '@bedtime/core/pipeline/stages/universe-fact-extractor'
import { loadUniverseContext } from './load-universe-context'

const router = Router()

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

function toSnakeCase(row: Story) {
  return {
    id: row.id,
    title: row.title,
    text_final: row.textFinal,
    plan_v1: row.planV1,
    plan_final: row.planFinal,
    plan_iterations: row.planIterations,
    text_v1: row.textV1,
    text_v2: row.textV2,
    plotter_model: row.plotterModel,
    plotter_prompt_version: row.plotterPromptVersion,
    plot_critic_model: row.plotCriticModel,
    plot_critic_prompt_version: row.plotCriticPromptVersion,
    writer_model: row.writerModel,
    writer_prompt_version: row.writerPromptVersion,
    writer_critic_model: row.writerCriticModel,
    writer_critic_prompt_version: row.writerCriticPromptVersion,
    created_at: row.createdAt,
    status: row.status,
    tags: row.tags,
    source: row.source,
    is_legacy: row.isLegacy,
    discussion_questions: row.discussionQuestions,
    seed: row.seed,
    group_id: row.groupId,
    plan_change_summary: row.planChangeSummary ?? null,
    mode: row.mode,
    text_change_summary: row.textChangeSummary ?? null,
    story_analysis: row.storyAnalysis ?? null,
    sort_order: row.sortOrder ?? null,
    series_id: row.seriesId ?? null,
    updated_at: row.updatedAt ?? null,
    ready_at: row.readyAt ?? null,
    active_text_version_id: row.activeTextVersionId ?? null,
  }
}

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
  type: z.enum(['sasha_reaction', 'my_note', 'sasha_laughed', 'sasha_loved', 'sasha_disliked']),
  selected_text: z.string().min(1),
  note_text: z.string().optional(),
  position_start: z.number().int().nonnegative(),
  position_end: z.number().int().nonnegative(),
  context: z.enum(['plan', 'text']).optional(),
})

router.post('/', validate(createStorySchema), async (req, res) => {
  try {
    const body = req.body as z.infer<typeof createStorySchema>
    const resolved = resolveCreateStoryMode(body)

    if (resolved.mode === 'legacy') {
      const legacyStory: NewStory = {
        title: resolved.title,
        textFinal: resolved.textFinal,
        status: resolved.addToReadingList ? 'ready' : 'read',
        source: 'legacy',
        mode: 'manual',
        ...(resolved.groupId !== undefined ? { groupId: resolved.groupId } : {}),
        ...(resolved.addToReadingList ? { readyAt: new Date() } : {}),
      }
      const [created] = await db.insert(stories).values(legacyStory).returning()

      res.status(201).json(toSnakeCase(created as Story))
      return
    }

    if (resolved.mode === 'user') {
      const userStory: NewStory = {
        title: resolved.title,
        textFinal: resolved.textFinal,
        status: 'ready',
        source: 'user',
        mode: 'manual',
        readyAt: new Date(),
        ...(resolved.groupId !== undefined ? { groupId: resolved.groupId } : {}),
      }
      const [created] = await db.insert(stories).values(userStory).returning()

      res.status(201).json(toSnakeCase(created as Story))
      return
    }

    const newStory: NewStory = {
      seed: resolved.seed,
      title: resolved.title,
      status: 'draft',
      source: 'agent',
      mode: resolved.pipelineMode ?? 'manual',
      ...(resolved.groupId !== undefined ? { groupId: resolved.groupId } : {}),
      ...(resolved.perStageOverrides !== undefined ? { agentOverrides: resolved.perStageOverrides } : {}),
    }
    const [story] = await db.insert(stories).values(newStory).returning()

    res.status(201).json(toSnakeCase(story as Story))
  } catch (err) {
    console.error('POST /stories failed:', err)
    res.status(500).json({ error: 'Failed to create story' })
  }
})

const reorderSchema = z.object({
  orders: z.array(z.object({ id: z.number().int(), sort_order: z.number().int() })),
})

router.post('/reorder', validate(reorderSchema), async (req, res) => {
  try {
    const { orders } = req.body as z.infer<typeof reorderSchema>

    if (orders.length === 0) {
      res.json({ ok: true })
      return
    }

    await Promise.all(
      orders.map(({ id, sort_order }) =>
        db.update(stories).set({ sortOrder: sort_order }).where(eq(stories.id, id)),
      ),
    )

    res.json({ ok: true })
  } catch (err) {
    console.error('POST /stories/reorder failed:', err)
    res.status(500).json({ error: 'Failed to reorder stories' })
  }
})

router.get('/tags', async (_req, res) => {
  try {
    const rows = await db
      .select({ tags: stories.tags })
      .from(stories)
      .where(sql`tags is not null and jsonb_array_length(tags::jsonb) > 0`)

    const all = Array.from(
      new Set(rows.flatMap((r) => (r.tags as string[] | null) ?? []))
    ).sort()

    res.json(all)
  } catch (err) {
    console.error('GET /stories/tags failed:', err)
    res.status(500).json({ error: 'Failed to fetch tags' })
  }
})

router.get('/', async (req, res) => {
  try {
    const { status, groupId, tag, sort } = req.query

    if (status !== undefined && typeof status !== 'string') {
      res.status(400).json({ error: 'Invalid status filter' })
      return
    }

    const conditions = []

    if (status) {
      conditions.push(eq(stories.status, status as 'draft' | 'ready' | 'read' | 'archived'))
    }

    if (groupId !== undefined && typeof groupId === 'string') {
      const gid = parseInt(groupId, 10)

      if (!isNaN(gid)) {
        conditions.push(eq(stories.groupId, gid))
      }
    }

    if (tag !== undefined && typeof tag === 'string') {
      conditions.push(sql`${stories.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`)
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    let orderExpr: ReturnType<typeof sql>

    if (sort === 'newest_read' || sort === 'oldest_read') {
      const dir = sort === 'newest_read' ? sql`DESC` : sql`ASC`
      orderExpr = sql`(SELECT MAX(read_at) FROM story_readings WHERE story_id = stories.id) ${dir} NULLS LAST`
    } else if (sort === 'created_desc') {
      orderExpr = sql`created_at DESC`
    } else if (sort === 'created_asc') {
      orderExpr = sql`created_at ASC`
    } else if (sort === 'updated_desc') {
      orderExpr = sql`updated_at DESC NULLS LAST`
    } else if (sort === 'ready_desc') {
      orderExpr = sql`ready_at DESC NULLS LAST`
    } else {
      orderExpr = sql`sort_order ASC NULLS LAST, created_at DESC`
    }

    const result = whereClause
      ? await db.select().from(stories).where(whereClause).orderBy(orderExpr) as Story[]
      : await db.select().from(stories).orderBy(orderExpr) as Story[]

    const totals = await db
      .select({
        storyId: modelCalls.storyId,
        totalUsdMicros: sql<number>`COALESCE(SUM(${modelCalls.usdMicros}), 0)::bigint`,
      })
      .from(modelCalls)
      .groupBy(modelCalls.storyId)

    const totalById = new Map<number, number>()
    for (const t of totals) {
      if (t.storyId !== null) totalById.set(t.storyId, Number(t.totalUsdMicros ?? 0))
    }

    res.json(result.map((row) => {
      const total = totalById.get(row.id)
      return { ...toSnakeCase(row), total_usd_micros: total ?? null }
    }))
  } catch (err) {
    console.error('GET /stories failed:', err)
    res.status(500).json({ error: 'Failed to fetch stories' })
  }
})

router.post('/:id/readings', async (req, res) => {
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

    const [reading] = await db.insert(storyReadings).values({ storyId }).returning()

    let statusUpdated = false

    if (story.status === 'ready') {
      await db.update(stories).set({ status: 'read', updatedAt: new Date() }).where(eq(stories.id, storyId))
      statusUpdated = true
    }

    res.status(201).json({ ok: true, readAt: reading!.readAt, statusUpdated })
  } catch (err) {
    console.error('POST /stories/:id/readings failed:', err)
    res.status(500).json({ error: 'Failed to record reading' })
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

    let activeText: string | null = null

    if (story.activeTextVersionId) {
      const [version] = await db
        .select({ text: storyTextVersions.text })
        .from(storyTextVersions)
        .where(eq(storyTextVersions.id, story.activeTextVersionId))

      activeText = version?.text ?? null
    }

    const callRows = await db
      .select({
        stage: modelCalls.stage,
        modelId: modelCalls.modelId,
        attempt: modelCalls.attempt,
        tokensIn: modelCalls.tokensIn,
        tokensOut: modelCalls.tokensOut,
        usdMicros: modelCalls.usdMicros,
        createdAt: modelCalls.createdAt,
      })
      .from(modelCalls)
      .where(eq(modelCalls.storyId, storyId))

    const validCallRows = callRows.filter((r): r is typeof r & { usdMicros: number; createdAt: Date } => r.usdMicros !== null && r.createdAt !== null)
    const cost = validCallRows.length > 0 ? deriveStoryCostBreakdown(validCallRows) : null

    res.json({ ...toSnakeCase(story as Story), cost, active_text: activeText })
  } catch (err) {
    console.error('GET /stories/:id failed:', err)
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
      .set({ status, updatedAt: new Date() })
      .where(eq(stories.id, storyId))
      .returning()

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    res.json(toSnakeCase(story as Story))
  } catch (err) {
    console.error('PATCH /stories/:id/status failed:', err)
    res.status(500).json({ error: 'Failed to update story status' })
  }
})

const updateTagsSchema = z.object({
  tags: z.array(z.string()),
})

router.patch('/:id/tags', validate(updateTagsSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { tags } = req.body as z.infer<typeof updateTagsSchema>
    const [story] = await db
      .update(stories)
      .set({ tags, updatedAt: new Date() })
      .where(eq(stories.id, storyId))
      .returning()

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    res.json(toSnakeCase(story as Story))
  } catch (err) {
    console.error('PATCH /stories/:id/tags failed:', err)
    res.status(500).json({ error: 'Failed to update tags' })
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

    const [existing] = await db.select().from(stories).where(eq(stories.id, storyId))

    if (!existing) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    if (!approved) {
      res.json(toSnakeCase(existing as Story))
      return
    }

    const decision = decideApprovePlan(
      {
        planV1: existing.planV1 ?? null,
        planFinal: existing.planFinal ?? null,
        seed: existing.seed ?? null,
        textV2: existing.textV2 ?? null,
      },
      getPipelineStatus(storyId),
    )

    if (decision.action === 'reject') {
      const message =
        decision.reason === 'plan_missing'
          ? 'Plan has not been generated yet; cannot approve'
          : 'Story seed is missing; cannot start text phase'
      res.status(decision.httpStatus).json({ error: message })
      return
    }

    if (decision.action === 'start_text_phase') {
      const { universeSystemPrompt, universeContext, styleGuide } = existing.groupId != null
        ? await loadUniverseContext(existing.groupId)
        : { universeSystemPrompt: undefined, universeContext: undefined, styleGuide: undefined }
      let sashaContext: string | null = null

      const [snapshot] = await db
        .select()
        .from(runSnapshots)
        .where(eq(runSnapshots.storyId, storyId))
        .orderBy(desc(runSnapshots.createdAt))
        .limit(1)

      if (snapshot?.sashaContext) {
        sashaContext = snapshot.sashaContext
      }

      await db.update(stories).set({ planFinal: decision.planV1, updatedAt: new Date() }).where(eq(stories.id, storyId))

      triggerTextPhase(storyId, decision.seed, decision.planV1, existing.mode ?? 'manual', universeSystemPrompt, sashaContext, universeContext, styleGuide)
    }

    res.json(toSnakeCase(existing as Story))
  } catch (err) {
    console.error('POST /stories/:id/approve-plan failed:', err)
    res.status(500).json({ error: 'Failed to approve plan' })
  }
})

router.post('/:id/redo-plan', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const [existing] = await db.select().from(stories).where(eq(stories.id, storyId))

    if (!existing || !existing.seed) {
      res.status(400).json({ error: 'Story not found or has no seed' })
      return
    }

    const { universeSystemPrompt, universeContext, styleGuide } = existing.groupId != null
      ? await loadUniverseContext(existing.groupId)
      : { universeSystemPrompt: undefined, universeContext: undefined, styleGuide: undefined }

    triggerPlanRedo(storyId, existing.seed, existing.planFinal ?? '', universeSystemPrompt, universeContext, styleGuide, existing.groupId ?? null)

    res.json({ started: true, storyId })
  } catch (err) {
    console.error('POST /stories/:id/redo-plan failed:', err)
    res.status(500).json({ error: 'Failed to start plan redo' })
  }
})

router.post('/:id/redo-text', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const [existing] = await db.select().from(stories).where(eq(stories.id, storyId))

    if (!existing) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    const currentText = existing.textV2 ?? existing.textV1

    if (!currentText) {
      res.status(409).json({ error: 'No text has been generated yet' })
      return
    }

    if (!existing.planFinal) {
      res.status(409).json({ error: 'Plan has not been approved yet' })
      return
    }

    const { universeSystemPrompt, universeContext, styleGuide } = existing.groupId != null
      ? await loadUniverseContext(existing.groupId)
      : { universeSystemPrompt: undefined, universeContext: undefined, styleGuide: undefined }
    let sashaContext: string | null = null

    const annotationRows = await db
      .select({ noteText: annotations.noteText })
      .from(annotations)
      .where(and(eq(annotations.storyId, storyId), eq(annotations.context, 'text')))

    const hasNotes = annotationRows.some((r) => r.noteText)

    if (!hasNotes) {
      res.status(409).json({ error: 'No editor notes found — add annotations with notes before redoing the text' })
      return
    }

    const [snapshot] = await db
      .select()
      .from(runSnapshots)
      .where(eq(runSnapshots.storyId, storyId))
      .orderBy(desc(runSnapshots.createdAt))
      .limit(1)

    if (snapshot?.sashaContext) {
      sashaContext = snapshot.sashaContext
    }

    triggerTextRewrite(storyId, currentText, existing.planFinal, universeSystemPrompt, universeContext, styleGuide, sashaContext, existing.groupId ?? null, existing.activeTextVersionId ?? null)

    res.json({ started: true, storyId })
  } catch (err) {
    console.error('POST /stories/:id/redo-text failed:', err)
    res.status(500).json({ error: 'Failed to start text redo' })
  }
})

router.post('/:id/critique-text', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const [existing] = await db.select().from(stories).where(eq(stories.id, storyId))

    if (!existing) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    if (!existing.textV1) {
      res.status(409).json({ error: 'Text v1 has not been generated yet' })
      return
    }

    if (!existing.planFinal) {
      res.status(409).json({ error: 'Plan has not been approved yet' })
      return
    }

    const { universeSystemPrompt, universeContext, styleGuide } = existing.groupId != null
      ? await loadUniverseContext(existing.groupId)
      : { universeSystemPrompt: undefined, universeContext: undefined, styleGuide: undefined }
    let sashaContext: string | null = null

    const [snapshot] = await db
      .select()
      .from(runSnapshots)
      .where(eq(runSnapshots.storyId, storyId))
      .orderBy(desc(runSnapshots.createdAt))
      .limit(1)

    if (snapshot?.sashaContext) {
      sashaContext = snapshot.sashaContext
    }

    const textToReview = existing.textV2 ?? existing.textV1
    triggerTextCritique(storyId, textToReview, existing.planFinal, universeSystemPrompt, universeContext, styleGuide, sashaContext, existing.groupId ?? null, existing.activeTextVersionId ?? null)

    res.json({ started: true, storyId })
  } catch (err) {
    console.error('POST /stories/:id/critique-text failed:', err)
    res.status(500).json({ error: 'Failed to start text critique' })
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

      res.json(toSnakeCase(existing as Story))
      return
    }

    const [current] = await db.select().from(stories).where(eq(stories.id, storyId))

    if (!current) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    const finalText = current.textV2 ?? current.textV1 ?? null

    const [story] = await db
      .update(stories)
      .set({ status: 'ready', textFinal: finalText, readyAt: new Date(), updatedAt: new Date() })
      .where(eq(stories.id, storyId))
      .returning()

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    res.json(toSnakeCase(story as Story))
  } catch (err) {
    console.error('POST /stories/:id/approve-text failed:', err)
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

    const { type, selected_text, note_text, position_start, position_end, context } = req.body as z.infer<
      typeof createAnnotationSchema
    >

    const resolvedContext = context ?? 'text'

    let textVersionId: number | null = null

    if (resolvedContext === 'text') {
      const [storyRow] = await db.select({ activeTextVersionId: stories.activeTextVersionId }).from(stories).where(eq(stories.id, storyId))
      textVersionId = storyRow?.activeTextVersionId ?? null
    }

    const newAnnotation: NewAnnotation = {
      storyId,
      type,
      selectedText: selected_text,
      noteText: note_text,
      positionStart: position_start,
      positionEnd: position_end,
      context: resolvedContext,
      ...(textVersionId !== null ? { textVersionId } : {}),
    }

    const [annotation] = await db.insert(annotations).values(newAnnotation).returning()

    res.status(201).json(annotation)
  } catch (err) {
    console.error('POST /stories/:id/annotations failed:', err)
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

    const context = req.query['context'] as 'plan' | 'text' | undefined
    const whereClause = context
      ? and(eq(annotations.storyId, storyId), eq(annotations.context, context))
      : eq(annotations.storyId, storyId)

    const result = await db
      .select()
      .from(annotations)
      .where(whereClause)

    res.json(result)
  } catch (err) {
    console.error('GET /stories/:id/annotations failed:', err)
    res.status(500).json({ error: 'Failed to fetch annotations' })
  }
})

const updateAnalysisSchema = z.object({
  storyAnalysis: z.string(),
})

router.post('/:id/analyze', async (req, res) => {
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

    if (story.source !== 'legacy') {
      res.status(422).json({ error: 'Only legacy stories can be analyzed' })
      return
    }

    if (!story.textFinal) {
      res.status(422).json({ error: 'Story has no text to analyze' })
      return
    }

    let universeContext: string | undefined

    if (story.groupId !== null && story.groupId !== undefined) {
      const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, story.groupId))

      if (group) {
        universeContext = group.universeContext ?? undefined
      }
    }

    console.log(`[analyze] story ${storyId} "${story.title}" — running analyzer`)

    const output = await runStoryAnalyzer({
      storyText: story.textFinal,
      ...(universeContext !== undefined ? { universeContext } : {}),
    })

    console.log(`[analyze] story ${storyId} — reactions: ${output.extracted_reactions.length}, saving analysis`)

    await db
      .update(stories)
      .set({ storyAnalysis: output.analysis_summary })
      .where(eq(stories.id, storyId))

    if (output.extracted_reactions.length > 0) {
      await db.insert(childDiary).values(
        output.extracted_reactions.map((r) => ({
          content: `Из истории «${story.title}»: ${r.reaction_text} — «${r.surrounding_quote}»`,
        })),
      )
    }

    let suggestionsCreated = 0

    if (story.groupId !== null && story.groupId !== undefined) {
      const groupId = story.groupId

      console.log(`[analyze] story ${storyId} — updating style guide for group ${groupId}`)
      const existingChars = await db
        .select({ name: universeCharacters.name, description: universeCharacters.description })
        .from(universeCharacters)
        .where(eq(universeCharacters.universeId, groupId))

      await Promise.all([
        updateStyleGuide(groupId, output, story.title),
        runUniverseFactExtractor({ storyText: story.textFinal, existingCharacters: existingChars })
          .then(async (factOutput) => {
            if (factOutput.facts.length === 0) return

            await db.insert(universeSuggestions).values(
              factOutput.facts.map((f) => ({
                universeId: groupId,
                factText: f.fact_text,
                sourceStoryId: storyId,
                status: 'pending' as const,
              })),
            )
            suggestionsCreated = factOutput.facts.length
          })
          .catch((err) => {
            console.error(`[analyze] story ${storyId} — fact extractor failed:`, err)
          }),
      ])
    }

    console.log(`[analyze] story ${storyId} — done`)

    res.json({
      storyAnalysis: output.analysis_summary,
      reactionsExtracted: output.extracted_reactions.length,
      styleGuideUpdated: story.groupId !== null && story.groupId !== undefined,
      suggestionsCreated,
    })
  } catch (err) {
    console.error('POST /stories/:id/analyze failed:', err)
    res.status(500).json({ error: 'Failed to analyze story' })
  }
})

const updateTextSchema = z.object({
  text: z.string().min(1),
})

router.patch('/:id/text', validate(updateTextSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { text } = req.body as z.infer<typeof updateTextSchema>

    const [story] = await db
      .update(stories)
      .set({ textFinal: text, updatedAt: new Date() })
      .where(eq(stories.id, storyId))
      .returning()

    if (!story) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    res.json(toSnakeCase(story as Story))
  } catch (err) {
    console.error('PATCH /stories/:id/text failed:', err)
    res.status(500).json({ error: 'Failed to update story text' })
  }
})

router.patch('/:id/analysis', validate(updateAnalysisSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { storyAnalysis } = req.body as z.infer<typeof updateAnalysisSchema>

    const [updated] = await db
      .update(stories)
      .set({ storyAnalysis, updatedAt: new Date() })
      .where(eq(stories.id, storyId))
      .returning()

    if (!updated) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    res.json(toSnakeCase(updated as Story))
  } catch (err) {
    console.error('PATCH /stories/:id/analysis failed:', err)
    res.status(500).json({ error: 'Failed to update story analysis' })
  }
})

const parentReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable().optional(),
  pacingOk: z.boolean().nullable().optional(),
  wouldReuse: z.boolean().nullable().optional(),
  notes: z.string().optional(),
})

const childReactionSchema = z.object({
  enjoyed: z.number().int().min(1).max(5).nullable().optional(),
  wasFunny: z.boolean().nullable().optional(),
  wasScary: z.boolean().nullable().optional(),
  tooLong: z.boolean().nullable().optional(),
  understoodMoral: z.boolean().nullable().optional(),
  wantAgain: z.boolean().nullable().optional(),
  favoriteMoment: z.string().optional(),
  favoriteCharacter: z.string().optional(),
  notes: z.string().optional(),
})

router.get('/:id/parent-review', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const [review] = await db.select().from(parentReviews).where(eq(parentReviews.storyId, storyId))

    res.json(review ?? null)
  } catch (err) {
    console.error('GET /stories/:id/parent-review failed:', err)
    res.status(500).json({ error: 'Failed to fetch parent review' })
  }
})

router.put('/:id/parent-review', validate(parentReviewSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const body = req.body as z.infer<typeof parentReviewSchema>

    const [review] = await db
      .insert(parentReviews)
      .values({ storyId, ...body, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: parentReviews.storyId,
        set: { ...body, updatedAt: new Date() },
      })
      .returning()

    res.json(review as ParentReview)
  } catch (err) {
    console.error('PUT /stories/:id/parent-review failed:', err)
    res.status(500).json({ error: 'Failed to save parent review' })
  }
})

router.get('/:id/child-reaction', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const [reaction] = await db.select().from(childReactions).where(eq(childReactions.storyId, storyId))

    res.json(reaction ?? null)
  } catch (err) {
    console.error('GET /stories/:id/child-reaction failed:', err)
    res.status(500).json({ error: 'Failed to fetch child reaction' })
  }
})

router.put('/:id/child-reaction', validate(childReactionSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const body = req.body as z.infer<typeof childReactionSchema>

    const [reaction] = await db
      .insert(childReactions)
      .values({ storyId, ...body, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: childReactions.storyId,
        set: { ...body, updatedAt: new Date() },
      })
      .returning()

    res.json(reaction as ChildReaction)
  } catch (err) {
    console.error('PUT /stories/:id/child-reaction failed:', err)
    res.status(500).json({ error: 'Failed to save child reaction' })
  }
})

const applyPlanPatchSchema = z.object({
  find: z.string().min(1),
  replace: z.string().min(1),
  summary: z.string(),
})

router.post('/:id/apply-plan-patch', validate(applyPlanPatchSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId) || storyId <= 0) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { find, replace, summary } = req.body as z.infer<typeof applyPlanPatchSchema>

    const [storyRow] = await db.select().from(stories).where(eq(stories.id, storyId))

    if (!storyRow) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    const currentPlan = storyRow.planV1 ?? storyRow.planFinal ?? ''

    if (!currentPlan.includes(find)) {
      res.status(422).json({ error: 'Patch target not found in plan — plan may have changed' })
      return
    }

    const newPlan = currentPlan.replace(find, replace)
    const [updated] = await db
      .update(stories)
      .set({ planV1: newPlan })
      .where(eq(stories.id, storyId))
      .returning()

    if (summary && storyRow.groupId) {
      const [universe] = await db.select().from(storyGroups).where(eq(storyGroups.id, storyRow.groupId))

      if (universe) {
        const existing = universe.styleGuideWorks ?? ''
        const appended = existing ? `${existing}\n- ${summary}` : `- ${summary}`

        await db
          .update(storyGroups)
          .set({ styleGuideWorks: appended })
          .where(eq(storyGroups.id, storyRow.groupId))
      }
    }

    res.json(toSnakeCase(updated as Story))
  } catch (err) {
    console.error('POST /stories/:id/apply-plan-patch failed:', err)
    res.status(500).json({ error: 'Failed to apply patch' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId) || storyId <= 0) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const [existing] = await db.select().from(stories).where(eq(stories.id, storyId))

    if (!existing) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    await db.delete(annotations).where(eq(annotations.storyId, storyId))
    await db.delete(runSnapshots).where(eq(runSnapshots.storyId, storyId))
    await db.delete(feedback).where(eq(feedback.storyId, storyId))
    await db.delete(planQuestions).where(eq(planQuestions.storyId, storyId))
    await db.delete(planConversations).where(eq(planConversations.storyId, storyId))
    await db.delete(storyReadings).where(eq(storyReadings.storyId, storyId))
    await db.delete(modelCalls).where(eq(modelCalls.storyId, storyId))
    await db.delete(storyTextVersions).where(eq(storyTextVersions.storyId, storyId))
    await db.delete(stories).where(eq(stories.id, storyId))

    res.status(204).send()
  } catch (err) {
    console.error('DELETE /stories/:id failed:', err)
    res.status(500).json({ error: 'Failed to delete story' })
  }
})

router.use('/:id/text-versions', textVersionsRouter)

export default router
