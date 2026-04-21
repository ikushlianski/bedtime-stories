import { Router } from 'express'
import { z } from 'zod'
import { eq, desc, and, sql } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, annotations, feedback, runSnapshots, storyGroups, planQuestions, planConversations, childDiary } from '@bedtime/core/db/schema'
import type { Story, NewStory, NewAnnotation } from '@bedtime/core/db/types'
import { validate } from '../middleware/validate'
import { triggerTextPhase, getPipelineStatus } from './pipeline'
import { triggerPlanRedo } from './pipeline-plan-redo'
import { triggerTextCritique, triggerTextRewrite } from './pipeline-text-critique'
import { decideApprovePlan } from './approve-plan-decision'
import { createStorySchema, resolveCreateStoryMode } from './create-story-schema'
import { runStoryAnalyzer } from '@bedtime/core/pipeline/stages/story-analyzer'
import { updateStyleGuide } from '@bedtime/core/pipeline/style-guide-updater'

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
    }
    const [story] = await db.insert(stories).values(newStory).returning()

    res.status(201).json(toSnakeCase(story as Story))
  } catch (err) {
    console.error('POST /stories failed:', err)
    res.status(500).json({ error: 'Failed to create story' })
  }
})

router.get('/', async (req, res) => {
  try {
    const { status, groupId, tag } = req.query

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

    const result = conditions.length > 0
      ? await db.select().from(stories).where(and(...conditions)).orderBy(desc(stories.createdAt))
      : await db.select().from(stories).orderBy(desc(stories.createdAt))

    res.json(result.map((row) => toSnakeCase(row as Story)))
  } catch (err) {
    console.error('GET /stories failed:', err)
    res.status(500).json({ error: 'Failed to fetch stories' })
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

    res.json(toSnakeCase(story as Story))
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
      .set({ status })
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
      .set({ tags })
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
      let universeSystemPrompt: string | undefined
      let universeContext: string | undefined
      let styleGuide: string | undefined
      let sashaContext: string | null = null

      if (existing.groupId !== null && existing.groupId !== undefined) {
        const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, existing.groupId))

        if (group) {
          universeSystemPrompt = group.systemPrompt
          universeContext = group.universeContext ?? undefined
          styleGuide = group.styleGuide ?? undefined
        }
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

      await db.update(stories).set({ planFinal: decision.planV1 }).where(eq(stories.id, storyId))

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

    let universeSystemPrompt: string | undefined
    let universeContext: string | undefined
    let styleGuide: string | undefined

    if (existing.groupId !== null && existing.groupId !== undefined) {
      const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, existing.groupId))

      if (group) {
        universeSystemPrompt = group.systemPrompt
        universeContext = group.universeContext ?? undefined
        styleGuide = group.styleGuide ?? undefined
      }
    }

    triggerPlanRedo(storyId, existing.seed, existing.planFinal ?? '', universeSystemPrompt, universeContext, styleGuide)

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

    let universeSystemPrompt: string | undefined
    let universeContext: string | undefined
    let styleGuide: string | undefined
    let sashaContext: string | null = null

    if (existing.groupId !== null && existing.groupId !== undefined) {
      const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, existing.groupId))

      if (group) {
        universeSystemPrompt = group.systemPrompt
        universeContext = group.universeContext ?? undefined
        styleGuide = group.styleGuide ?? undefined
      }
    }

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

    triggerTextRewrite(storyId, currentText, existing.planFinal, universeSystemPrompt, universeContext, styleGuide, sashaContext)

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

    let universeSystemPrompt: string | undefined
    let universeContext: string | undefined
    let styleGuide: string | undefined
    let sashaContext: string | null = null

    if (existing.groupId !== null && existing.groupId !== undefined) {
      const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, existing.groupId))

      if (group) {
        universeSystemPrompt = group.systemPrompt
        universeContext = group.universeContext ?? undefined
        styleGuide = group.styleGuide ?? undefined
      }
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

    const textToReview = existing.textV2 ?? existing.textV1
    triggerTextCritique(storyId, textToReview, existing.planFinal, universeSystemPrompt, universeContext, styleGuide, sashaContext)

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
      .set({ status: 'ready', textFinal: finalText })
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

    const newAnnotation: NewAnnotation = {
      storyId,
      type,
      selectedText: selected_text,
      noteText: note_text,
      positionStart: position_start,
      positionEnd: position_end,
      context: context ?? 'text',
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

    if (story.groupId !== null && story.groupId !== undefined) {
      console.log(`[analyze] story ${storyId} — updating style guide for group ${story.groupId}`)
      await updateStyleGuide(story.groupId, output, story.title)
    }

    console.log(`[analyze] story ${storyId} — done`)

    res.json({
      storyAnalysis: output.analysis_summary,
      reactionsExtracted: output.extracted_reactions.length,
      styleGuideUpdated: story.groupId !== null && story.groupId !== undefined,
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
      .set({ textFinal: text })
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
      .set({ storyAnalysis })
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
    await db.delete(stories).where(eq(stories.id, storyId))

    res.status(204).send()
  } catch (err) {
    console.error('DELETE /stories/:id failed:', err)
    res.status(500).json({ error: 'Failed to delete story' })
  }
})

export default router
