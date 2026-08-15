import { Router } from 'express'
import { eq, and, asc } from 'drizzle-orm'
import { z } from 'zod'
import { validate } from '../middleware/validate'
import { db } from '@bedtime/core/db/client'
import { planQuestions, planConversations, stories, storyGroups, storyTextVersions, annotations } from '@bedtime/core/db/schema'
import { loadUniverseContext } from './load-universe-context'
import { getStoryUniverseIds } from './story-universe-links'
import { aiRunner } from '@bedtime/core/ai'
import { triggerPlanPhaseFromAnswers } from './pipeline-plan-trigger'
import { resolveChatGate } from '@bedtime/core/pipeline/resolve-chat-gate'
import { parsePatchBlock } from '@bedtime/core/pipeline/parse-patch-block'
import { resolveTargetInText } from '@bedtime/core/pipeline/resolve-target-in-text'
import { sendMessageSchema } from './send-message-schema'

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

    const universeIds = await getStoryUniverseIds(storyIdRaw, storyRow.groupId)
    const { universeSystemPrompt, universeContext, styleGuide, bibleCharacters } = await loadUniverseContext(universeIds)

    const updatedQuestions = await db
      .select()
      .from(planQuestions)
      .where(eq(planQuestions.storyId, storyIdRaw))

    const qaArray = updatedQuestions
      .filter((q) => q.answerText !== null && q.answerText !== undefined)
      .map((q) => ({ question: q.questionText, answer: q.answerText ?? '' }))

    triggerPlanPhaseFromAnswers(storyIdRaw, seed, qaArray, universeSystemPrompt, universeContext, styleGuide, universeIds, bibleCharacters)

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

    const universeIds2 = await getStoryUniverseIds(storyIdRaw, storyRow.groupId)
    const { universeSystemPrompt: usp2, universeContext: uc2, styleGuide: sg2, bibleCharacters: bc2 } = await loadUniverseContext(universeIds2)

    triggerPlanPhaseFromAnswers(storyIdRaw, seed, qaArray, usp2, uc2, sg2, universeIds2, bc2)

    res.json({ ok: true, storyId: storyIdRaw })
  } catch (err) {
    console.error('POST /pipeline/questions/:storyId/retry-plan failed:', err)
    res.status(500).json({ error: 'Failed to retry plan phase' })
  }
})

async function resolveSourceText(storyRow: typeof stories.$inferSelect, context: 'plan' | 'text'): Promise<string> {
  if (context === 'plan') {
    return storyRow.planV1 ?? storyRow.planFinal ?? ''
  }

  if (storyRow.activeTextVersionId) {
    const [version] = await db
      .select({ text: storyTextVersions.text })
      .from(storyTextVersions)
      .where(eq(storyTextVersions.id, storyRow.activeTextVersionId))

    if (version) return version.text
  }

  return storyRow.textV2 ?? storyRow.textV1 ?? ''
}

router.get('/conversations/:storyId', async (req, res) => {
  try {
    const storyIdRaw = parseStoryId(req.params['storyId'])

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const context = (req.query['context'] as 'plan' | 'text' | undefined) ?? 'plan'

    const messages = await db
      .select()
      .from(planConversations)
      .where(and(eq(planConversations.storyId, storyIdRaw), eq(planConversations.context, context)))
      .orderBy(asc(planConversations.createdAt))

    res.json(messages)
  } catch (err) {
    console.error('GET /pipeline/conversations/:storyId failed:', err)
    res.status(500).json({ error: 'Failed to get conversations' })
  }
})

router.post('/conversations/:storyId', validate(sendMessageSchema), async (req, res) => {
  try {
    const storyIdRaw = parseStoryId(req.params['storyId'])

    if (isNaN(storyIdRaw)) {
      res.status(400).json({ error: 'Invalid storyId' })
      return
    }

    const { message, selectedText, context } = req.body as z.infer<typeof sendMessageSchema>
    const resolvedContext = context ?? 'plan'

    const [storyRow] = await db.select().from(stories).where(eq(stories.id, storyIdRaw))

    if (!storyRow) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    const gate = resolveChatGate({ storyStatus: storyRow.status ?? 'draft', intent: 'mutate' })

    if (!gate.allowed) {
      res.status(409).json({ error: gate.reason, suggestedEndpoint: gate.suggestedEndpoint })
      return
    }

    const [userMessage] = await db
      .insert(planConversations)
      .values({ storyId: storyIdRaw, role: 'user', content: message, context: resolvedContext })
      .returning()

    if (!userMessage) {
      res.status(500).json({ error: 'Failed to store user message' })
      return
    }

    const trimmedSelection = selectedText?.trim()

    const priorMessages = await db
      .select()
      .from(planConversations)
      .where(and(eq(planConversations.storyId, storyIdRaw), eq(planConversations.context, resolvedContext)))
      .orderBy(asc(planConversations.createdAt))

    const currentText = await resolveSourceText(storyRow, resolvedContext)
    const subjectLabel = resolvedContext === 'plan' ? 'bedtime story plan' : 'bedtime story text'

    const conversationContext = priorMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n')

    const instructionBlock = trimmedSelection
      ? [
          ``,
          `The user is focusing on this specific passage from the ${resolvedContext === 'plan' ? 'plan' : 'text'}:`,
          `"""`,
          trimmedSelection,
          `"""`,
          ``,
          `If you arrive at a concrete replacement for this passage, output it using this exact format at the end of your response:`,
          `<<<PATCH>>>`,
          `[replacement text]`,
          `<<<END PATCH>>>`,
          `<<<SUMMARY>>>`,
          `[1-2 sentence summary of what changed and why, for future story generation memory]`,
          `<<<END SUMMARY>>>`,
          `Only include a PATCH block when you have a clear, agreed improvement. Skip it if you are still exploring options.`,
        ].join('\n')
      : [
          ``,
          `The user has not pre-selected a specific passage. Discuss their request against the full ${resolvedContext === 'plan' ? 'plan' : 'text'} above.`,
          `If — and only if — you identify one concrete, specific passage to change, quote that passage verbatim as an exact, character-for-character substring of the current ${resolvedContext === 'plan' ? 'plan' : 'text'} above (not paraphrased, not shortened, not re-punctuated) inside this marker block:`,
          `<<<TARGET>>>`,
          `[verbatim passage copied exactly from the current ${resolvedContext === 'plan' ? 'plan' : 'text'} above]`,
          `<<<END TARGET>>>`,
          `Then immediately follow it with the replacement, using this exact format:`,
          `<<<PATCH>>>`,
          `[replacement text]`,
          `<<<END PATCH>>>`,
          `<<<SUMMARY>>>`,
          `[1-2 sentence summary of what changed and why, for future story generation memory]`,
          `<<<END SUMMARY>>>`,
          `If the request is general and does not map to one specific passage (e.g. "make it funnier overall"), just respond in plain conversational text — do not include TARGET, PATCH, or SUMMARY blocks.`,
          `Always give a real, substantive reply. Never leave the response empty, and never respond only with markers and no discussion.`,
        ].join('\n')

    const prompt = [
      `You are helping refine a ${subjectLabel}. Here is the current ${resolvedContext}:\n${currentText}`,
      `Discuss and suggest improvements conversationally. Be concise and direct.`,
      instructionBlock,
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
      .values({ storyId: storyIdRaw, role: 'assistant', content: aiResponse, context: resolvedContext })
      .returning()

    if (!assistantMessage) {
      res.status(500).json({ error: 'Failed to store assistant message' })
      return
    }

    const parsedPatch = parsePatchBlock(aiResponse)

    let patch = parsedPatch?.patch
    let patchSummary = parsedPatch?.summary
    let target: string | undefined

    if (!trimmedSelection && patch) {
      const resolvedTarget = parsedPatch?.target ? resolveTargetInText(currentText, parsedPatch.target) : { ok: false as const }

      if (resolvedTarget.ok) {
        target = resolvedTarget.resolvedTarget
      } else {
        patch = undefined
        patchSummary = undefined
      }
    }

    let banked = false
    let bankedAnnotation: typeof annotations.$inferSelect | undefined

    if (!trimmedSelection && !patch) {
      const [inserted] = await db
        .insert(annotations)
        .values({
          storyId: storyIdRaw,
          type: 'my_note',
          selectedText: null,
          noteText: message,
          context: resolvedContext,
        })
        .returning()

      banked = true
      bankedAnnotation = inserted
    }

    res.json({ userMessage, assistantMessage, patch, patchSummary, target, banked, annotation: bankedAnnotation })
  } catch (err) {
    console.error('POST /pipeline/conversations/:storyId failed:', err)
    res.status(500).json({ error: 'Failed to send conversation message' })
  }
})

export default router
