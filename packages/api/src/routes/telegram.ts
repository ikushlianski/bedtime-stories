import { Bot, Context, InlineKeyboard } from 'grammy'
import { eq, desc } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client.js'
import { stories, storyGroups, annotations } from '@bedtime/core/db/schema.js'
import { deriveIsAuthorizedUser, deriveIdeaFromMessage } from './telegram-utils.js'
import { triggerAutoPipeline } from './pipeline-auto-trigger.js'
import { registerStoryReadyCallback } from './pipeline-notifications.js'

export { deriveIsAuthorizedUser, deriveIdeaFromMessage }

type BotState = 'idle' | 'awaiting_seed' | 'in_story' | 'awaiting_feedback'

const token = process.env['TELEGRAM_BOT_TOKEN']
const allowedUserId = Number(process.env['TELEGRAM_ALLOWED_USER_ID'] ?? '0')

const userState = new Map<number, BotState>()
const pendingSeeds = new Map<number, { seedText: string; universeId: number }>()
const pendingFeedback = new Map<number, number>()

async function createStoryAndFire(seedText: string, universeId: number): Promise<number> {
  const [universe] = await db.select().from(storyGroups).where(eq(storyGroups.id, universeId))

  const [newStory] = await db
    .insert(stories)
    .values({
      groupId: universeId,
      seed: seedText,
      status: 'draft',
      mode: 'auto',
      source: 'agent',
    })
    .returning({ id: stories.id })

  const storyId = newStory!.id

  triggerAutoPipeline(
    storyId,
    seedText,
    universe?.systemPrompt ?? undefined,
    universe?.universeContext ?? undefined,
    universe?.styleGuide ?? undefined,
    universeId,
  )

  return storyId
}

async function sendStoriesList(ctx: Context): Promise<void> {
  const allStories = await db
    .select({ id: stories.id, title: stories.title, status: stories.status })
    .from(stories)
    .orderBy(desc(stories.createdAt))
    .limit(20)

  if (allStories.length === 0) {
    await ctx.reply('Историй пока нет.')
    return
  }

  const kb = new InlineKeyboard()

  for (const s of allStories) {
    const emoji = s.status === 'ready' ? '✅' : s.status === 'read' ? '📝' : s.status === 'archived' ? '🗂️' : s.status === 'proofreading' ? '📖' : '⏳'
    const label = `${emoji} ${s.title || `История #${s.id}`}`
    kb.text(label, `story:${s.id}`).row()
  }

  await ctx.reply('Твои истории:', { reply_markup: kb })
}

export const bot: Bot<Context> | null = token ? new Bot<Context>(token) : null

if (bot) {
  registerStoryReadyCallback((storyId) => {
    bot!.api.sendMessage(allowedUserId, `История #${storyId} готова! Используй /stories, чтобы прочитать.`).catch((err) => {
      console.error('[telegram] failed to send story-ready notification:', err)
    })
  })

  bot.command('start', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return
    userState.set(ctx.from!.id, 'idle')
    await ctx.reply('Привет! Отправь мне идею для сказки, и я создам её для Саши.')
  })

  bot.command('stories', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return
    await sendStoriesList(ctx)
  })

  bot.callbackQuery(/^story:\d+$/, async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) {
      await ctx.answerCallbackQuery()
      return
    }

    const storyId = parseInt(ctx.callbackQuery.data.split(':')[1] ?? '0', 10)
    const [story] = await db
      .select({ title: stories.title, textFinal: stories.textFinal, status: stories.status })
      .from(stories)
      .where(eq(stories.id, storyId))

    await ctx.answerCallbackQuery()

    if (!story) {
      await ctx.reply('История не найдена.')
      return
    }

    if (!story.textFinal) {
      await ctx.reply('История ещё генерируется, подожди немного ⏳')
      return
    }

    const header = story.title ? `*${story.title}*\n\n` : ''
    const fullText = header + story.textFinal
    const CHUNK_SIZE = 4096

    for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
      const chunk = fullText.slice(i, i + CHUNK_SIZE)
      if (i === 0 && header) {
        await ctx.reply(chunk, { parse_mode: 'Markdown' })
      } else {
        await ctx.reply(chunk)
      }
    }

    const postReadKb = new InlineKeyboard()
      .text('Оставить отзыв', `feedback_req:${storyId}`)
      .text('← Истории', 'back_stories')

    await ctx.reply('Что дальше?', { reply_markup: postReadKb })
  })

  bot.callbackQuery(/^feedback_req:\d+$/, async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) {
      await ctx.answerCallbackQuery()
      return
    }

    const userId = ctx.from.id
    const storyId = parseInt(ctx.callbackQuery.data.split(':')[1] ?? '0', 10)

    pendingFeedback.set(userId, storyId)
    userState.set(userId, 'awaiting_feedback')
    await ctx.answerCallbackQuery()
    await ctx.reply('Напиши свой отзыв на историю:')
  })

  bot.callbackQuery('back_stories', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) {
      await ctx.answerCallbackQuery()
      return
    }

    await ctx.answerCallbackQuery()
    await sendStoriesList(ctx)
  })

  bot.on('message:text', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return

    const userId = ctx.from.id
    const text = ctx.message.text.trim()
    const state = userState.get(userId)

    if (state === 'awaiting_feedback') {
      const storyId = pendingFeedback.get(userId)

      if (storyId) {
        await db.insert(annotations).values({
          storyId,
          type: 'my_note',
          selectedText: 'Общий отзыв',
          noteText: text,
          context: 'text',
        })

        pendingFeedback.delete(userId)
        userState.set(userId, 'idle')
        await ctx.reply('Отзыв сохранён! ✓')
      }

      return
    }

    const universes = await db.select({ id: storyGroups.id, name: storyGroups.name }).from(storyGroups)

    if (universes.length === 1) {
      const universe = universes[0]!
      userState.set(userId, 'in_story')
      pendingSeeds.delete(userId)
      await ctx.reply('Генерирую, скоро пришлю!')
      await createStoryAndFire(text, universe.id)
      return
    }

    pendingSeeds.set(userId, { seedText: text, universeId: 0 })
    userState.set(userId, 'awaiting_seed')

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

    const userId = ctx.from.id
    const universeId = parseInt(ctx.callbackQuery.data.split(':')[1] ?? '0', 10)
    const pending = pendingSeeds.get(userId)

    if (!pending) {
      await ctx.answerCallbackQuery({ text: 'Нет ожидающего текста — отправь идею ещё раз' })
      return
    }

    pendingSeeds.delete(userId)
    userState.set(userId, 'in_story')
    await ctx.answerCallbackQuery()
    await ctx.reply('Генерирую, скоро пришлю!')
    await createStoryAndFire(pending.seedText, universeId)
  })
}
