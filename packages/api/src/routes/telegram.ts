import { Bot, Context, InlineKeyboard } from 'grammy'
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from '@grammyjs/conversations'
import { asc, eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client.js'
import { planQuestions, storyGroups, storyIdeas, stories } from '@bedtime/core/db/schema.js'
import { runQuestionsPhase } from '@bedtime/core/pipeline/orchestrator.js'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer.js'
import { resolvePipelineModels } from './pipeline-defaults.js'
import { setPipelineStatus } from './pipeline-state.js'
import { triggerPlanPhaseFromAnswers } from './pipeline-plan-trigger.js'

type BotContext = ConversationFlavor<Context>
type BotConversation = Conversation<BotContext, BotContext>

const token = process.env['TELEGRAM_BOT_TOKEN']
const allowedUserId = Number(process.env['TELEGRAM_ALLOWED_USER_ID'] ?? '0')

export function deriveIsAuthorizedUser(fromId: number | undefined, allowedId: number): boolean {
  return fromId !== undefined && fromId === allowedId
}

export function deriveIdeaFromMessage(
  messageText: string,
  universeId: number,
): { seedText: string; topic: string; rationale: string; universeId: number } {
  return {
    seedText: messageText.trim(),
    topic: 'Telegram',
    rationale: 'Submitted via Telegram bot',
    universeId,
  }
}

const pendingSeeds = new Map<number, { seedText: string; universeId: number }>()

async function ideaConversation(conversation: BotConversation, ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id

  if (!userId) {
    return
  }

  const pending = pendingSeeds.get(userId)

  if (!pending) {
    await ctx.reply('Нет ожидающего текста — отправь идею ещё раз')
    return
  }

  const { seedText, universeId } = pending
  pendingSeeds.delete(userId)

  await ctx.reply('Генерирую вопросы...')

  const { storyId, questions } = await conversation.external(async () => {
    const ideaPayload = deriveIdeaFromMessage(seedText, universeId)

    await db.insert(storyIdeas).values({
      ...ideaPayload,
      status: 'approved',
      approvedAt: new Date(),
      ideaSuggesterModel: 'telegram',
    })

    const [newStory] = await db
      .insert(stories)
      .values({
        groupId: universeId,
        seed: seedText,
        status: 'draft',
        mode: 'manual',
        source: 'agent',
      })
      .returning({ id: stories.id })

    const storyId = newStory!.id

    const [universe] = await db.select().from(storyGroups).where(eq(storyGroups.id, universeId))
    const [sashaContext, models] = await Promise.all([
      synthesizeSashaContext(),
      resolvePipelineModels(universeId, null),
    ])

    const questions = await runQuestionsPhase({
      seed: seedText,
      storyId,
      models,
      ...(universe?.systemPrompt !== undefined ? { universeSystemPrompt: universe.systemPrompt } : {}),
      ...(universe?.universeContext != null ? { universeContext: universe.universeContext } : {}),
      ...(sashaContext !== null ? { sashaContext } : {}),
    })

    await db.delete(planQuestions).where(eq(planQuestions.storyId, storyId))
    await db.insert(planQuestions).values(
      questions.map((q) => ({
        storyId,
        questionText: q.question,
        answerOptions: (q.options ?? []) as string[],
      })),
    )

    setPipelineStatus(storyId, 'questions_pending')

    return { storyId, questions }
  })

  const answers: Array<{ question: string; answer: string }> = []

  for (const q of questions) {
    const options = (q.options ?? []) as string[]

    if (options.length > 0) {
      const kb = new InlineKeyboard()

      for (const opt of options) {
        kb.text(opt, `ans:${opt}`).row()
      }

      await ctx.reply(q.question, { reply_markup: kb })
      const ansCtx = await conversation.waitFor('callback_query:data')
      await ansCtx.answerCallbackQuery()
      answers.push({
        question: q.question,
        answer: ansCtx.callbackQuery.data.replace(/^ans:/, ''),
      })
    } else {
      await ctx.reply(q.question)
      const ansCtx = await conversation.waitFor('message:text')
      answers.push({ question: q.question, answer: ansCtx.message.text })
    }
  }

  await conversation.external(async () => {
    const dbQuestions = await db
      .select()
      .from(planQuestions)
      .where(eq(planQuestions.storyId, storyId))
      .orderBy(asc(planQuestions.createdAt))

    const now = new Date()

    for (let i = 0; i < dbQuestions.length; i++) {
      const dbQ = dbQuestions[i]
      const answer = answers[i]

      if (dbQ && answer) {
        await db
          .update(planQuestions)
          .set({ answerText: answer.answer, answeredAt: now })
          .where(eq(planQuestions.id, dbQ.id))
      }
    }

    const [storyRow] = await db.select().from(stories).where(eq(stories.id, storyId))
    const seed = storyRow?.seed ?? seedText
    const gId = storyRow?.groupId ?? universeId

    const [universe] = await db.select().from(storyGroups).where(eq(storyGroups.id, gId))

    triggerPlanPhaseFromAnswers(
      storyId,
      seed,
      answers,
      universe?.systemPrompt,
      universe?.universeContext ?? undefined,
      universe?.styleGuide ?? undefined,
      gId,
    )
  })

  await ctx.reply(`История #${storyId} создана, пайплайн запущен ✓`)
}

export const bot: Bot<BotContext> | null = token ? new Bot<BotContext>(token) : null

if (bot) {
  bot.use(conversations())
  bot.use(createConversation(ideaConversation))

  bot.on('message:text', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) {
      return
    }

    pendingSeeds.set(ctx.from.id, { seedText: ctx.message.text.trim(), universeId: 0 })

    const universes = await db.select({ id: storyGroups.id, name: storyGroups.name }).from(storyGroups)

    const kb = new InlineKeyboard()

    for (const u of universes) {
      kb.text(u.name, `universe:${u.id}`).row()
    }

    await ctx.reply('Выбери вселенную:', { reply_markup: kb })
  })

  bot.callbackQuery(/^universe:\d+$/, async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) {
      await ctx.answerCallbackQuery()
      return
    }

    const universeId = parseInt(ctx.callbackQuery.data.split(':')[1] ?? '0', 10)
    const pending = pendingSeeds.get(ctx.from.id)

    if (!pending) {
      await ctx.answerCallbackQuery({ text: 'Нет ожидающего текста — отправь идею ещё раз' })
      return
    }

    pending.universeId = universeId
    await ctx.answerCallbackQuery()
    await ctx.conversation.enter('ideaConversation')
  })
}
