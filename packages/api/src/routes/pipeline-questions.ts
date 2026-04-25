import { Router } from 'express'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { db } from '@bedtime/core/db/client'
import { planQuestions, planConversations, stories, storyGroups } from '@bedtime/core/db/schema'
import { loadUniverseContext } from './load-universe-context'
import { aiRunner } from '@bedtime/core/ai'
import { updateUniverseContext } from '@bedtime/core/pipeline/universe-context-updater'
import { triggerPlanPhaseFromAnswers } from './pipeline-plan-trigger'

const router = Router()

function parseStoryId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

router.get('/questions/:storyId', async (req, res) => {
  try {
    const storyIdRaw = parseStoryId(req.params['storyId'])

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const questions = await db
      .select()
      .from(planQuestions)
      .where(eq(planQuestions.storyId, storyIdRaw))

    res.json(questions)
  } catch (err) {
    console.error('GET /pipeline/questions/:storyId failed:', err)
    res.status(500).json({ error: 'Failed to get questions' })
  }
})

const submitAnswersSchema = z.object({
  answers: z.array(
    z.object({
      id: z.number().int().positive(),
      answer: z.string().min(1),
    }),
  ).min(1),
})

router.post('/questions/:storyId/submit', validate(submitAnswersSchema), async (req, res) => {
  try {
    const storyIdRaw = parseStoryId(req.params['storyId'])

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const { answers } = req.body as z.infer<typeof submitAnswersSchema>

    const existingQuestions = await db
      .select()
      .from(planQuestions)
      .where(eq(planQuestions.storyId, storyIdRaw))

    const existingIds = new Set(existingQuestions.map((q) => q.id))

    for (const answer of answers) {
      if (!existingIds.has(answer.id)) {
        res.status(400).json({ error: `Question id ${answer.id} not found for this story` })
        return
      }
    }

    const now = new Date()

    for (const answer of answers) {
      await db
        .update(planQuestions)
        .set({ answerText: answer.answer, answeredAt: now })
        .where(eq(planQuestions.id, answer.id))
    }

    const [storyRow] = await db.select().from(stories).where(eq(stories.id, storyIdRaw))

    if (!storyRow) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    const seed = storyRow.seed ?? ''

    const { universeSystemPrompt, universeContext, styleGuide } = storyRow.groupId != null
      ? await loadUniverseContext(storyRow.groupId)
      : { universeSystemPrompt: undefined, universeContext: undefined, styleGuide: undefined }

    const updatedQuestions = await db
      .select()
      .from(planQuestions)
      .where(eq(planQuestions.storyId, storyIdRaw))

    const qaArray = updatedQuestions
      .filter((q) => q.answerText !== null && q.answerText !== undefined)
      .map((q) => ({ question: q.questionText, answer: q.answerText ?? '' }))

    triggerPlanPhaseFromAnswers(storyIdRaw, seed, qaArray, universeSystemPrompt, universeContext, styleGuide, storyRow.groupId ?? null)

    if (storyRow.groupId !== null && storyRow.groupId !== undefined) {
      void updateUniverseContext(storyRow.groupId, qaArray, seed)
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('POST /pipeline/questions/:storyId/submit failed:', err)
    res.status(500).json({ error: 'Failed to submit answers' })
  }
})

router.post('/questions/:storyId/retry-plan', async (req, res) => {
  try {
    const storyIdRaw = parseStoryId(req.params['storyId'])

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const [storyRow] = await db.select().from(stories).where(eq(stories.id, storyIdRaw))

    if (!storyRow) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    const answeredQuestions = await db
      .select()
      .from(planQuestions)
      .where(eq(planQuestions.storyId, storyIdRaw))

    const qaArray = answeredQuestions
      .filter((q) => q.answerText !== null && q.answerText !== undefined)
      .map((q) => ({ question: q.questionText, answer: q.answerText ?? '' }))

    if (qaArray.length === 0) {
      res.status(422).json({ error: 'No answered questions found — cannot retry plan phase' })
      return
    }

    const seed = storyRow.seed ?? ''

    const { universeSystemPrompt: usp2, universeContext: uc2, styleGuide: sg2 } = storyRow.groupId != null
      ? await loadUniverseContext(storyRow.groupId)
      : { universeSystemPrompt: undefined, universeContext: undefined, styleGuide: undefined }

    triggerPlanPhaseFromAnswers(storyIdRaw, seed, qaArray, usp2, uc2, sg2, storyRow.groupId ?? null)

    res.json({ ok: true, storyId: storyIdRaw })
  } catch (err) {
    console.error('POST /pipeline/questions/:storyId/retry-plan failed:', err)
    res.status(500).json({ error: 'Failed to retry plan phase' })
  }
})

router.get('/conversations/:storyId', async (req, res) => {
  try {
    const storyIdRaw = parseStoryId(req.params['storyId'])

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const messages = await db
      .select()
      .from(planConversations)
      .where(eq(planConversations.storyId, storyIdRaw))
      .orderBy(asc(planConversations.createdAt))

    res.json(messages)
  } catch (err) {
    console.error('GET /pipeline/conversations/:storyId failed:', err)
    res.status(500).json({ error: 'Failed to get conversations' })
  }
})

const sendMessageSchema = z.object({
  message: z.string().min(1),
})

router.post('/conversations/:storyId', validate(sendMessageSchema), async (req, res) => {
  try {
    const storyIdRaw = parseStoryId(req.params['storyId'])

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const { message } = req.body as z.infer<typeof sendMessageSchema>

    const [storyRow] = await db.select().from(stories).where(eq(stories.id, storyIdRaw))

    if (!storyRow) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    const [userMessage] = await db
      .insert(planConversations)
      .values({ storyId: storyIdRaw, role: 'user', content: message })
      .returning()

    if (!userMessage) {
      res.status(500).json({ error: 'Failed to store user message' })
      return
    }

    const priorMessages = await db
      .select()
      .from(planConversations)
      .where(eq(planConversations.storyId, storyIdRaw))
      .orderBy(asc(planConversations.createdAt))

    const planFinal = storyRow.planFinal ?? ''

    const conversationContext = priorMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const prompt = [
      `You are helping refine a story plan. Here is the current plan:\n${planFinal}`,
      `Discuss and suggest improvements conversationally. Be concise.`,
      ``,
      `Conversation so far:`,
      conversationContext,
    ].join('\n')

    const aiResponse = await aiRunner.runText({
      model: 'anthropic/claude-sonnet-4',
      fallback: 'anthropic/claude-3.5-haiku',
      prompt,
      label: 'plan-conversation',
    })

    const [assistantMessage] = await db
      .insert(planConversations)
      .values({ storyId: storyIdRaw, role: 'assistant', content: aiResponse })
      .returning()

    if (!assistantMessage) {
      res.status(500).json({ error: 'Failed to store assistant message' })
      return
    }

    res.json({ userMessage, assistantMessage })
  } catch (err) {
    console.error('POST /pipeline/conversations/:storyId failed:', err)
    res.status(500).json({ error: 'Failed to send conversation message' })
  }
})

export default router
