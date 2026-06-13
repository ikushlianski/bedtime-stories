import { Bot, Context, InlineKeyboard } from 'grammy'
import { desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client.js'
import { stories, storyGroups, storyReadings } from '@bedtime/core/db/schema.js'
import { deriveIsAuthorizedUser, deriveIdeaFromMessage } from './telegram-utils.js'
import {
  UNREAD_STATUSES,
  READ_STATUSES,
  parseStoryIdMessage,
  formatStoriesList,
  storyLabel,
  chunkText,
  pickReadableText,
} from './telegram-format.js'
import { triggerAutoPipeline } from './pipeline-auto-trigger.js'
import { registerStoryReadyCallback } from './pipeline-notifications.js'

export { deriveIsAuthorizedUser, deriveIdeaFromMessage }

const token = process.env['TELEGRAM_BOT_TOKEN']
const allowedUserId = Number(process.env['TELEGRAM_ALLOWED_USER_ID'] ?? '0')

const CATEGORY_UNREAD = 'cat:unread'
const CATEGORY_READ = 'cat:read'
const STORIES_MENU = 'stories:menu'
const LIST_LIMIT = 30

async function resolveDefaultUniverseId(): Promise<number | null> {
  const [recent] = await db
    .select({ groupId: stories.groupId })
    .from(stories)
    .where(isNotNull(stories.groupId))
    .orderBy(desc(stories.createdAt))
    .limit(1)

  if (recent?.groupId) {
    return recent.groupId
  }

  const [first] = await db.select({ id: storyGroups.id }).from(storyGroups).orderBy(storyGroups.id).limit(1)

  return first?.id ?? null
}

async function createStoryAndFire(seedText: string): Promise<number | null> {
  const universeId = await resolveDefaultUniverseId()

  if (universeId === null) {
    return null
  }

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

function categoryKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📥 Новые / на вычитке', CATEGORY_UNREAD)
    .row()
    .text('📖 Прочитанные', CATEGORY_READ)
}

async function sendCategoryMenu(ctx: Context): Promise<void> {
  await ctx.reply('Какие сказки показать?', { reply_markup: categoryKeyboard() })
}

async function sendStoriesByCategory(ctx: Context, category: 'unread' | 'read'): Promise<void> {
  const statuses = category === 'unread' ? UNREAD_STATUSES : READ_STATUSES

  const rows = await db
    .select({ id: stories.id, title: stories.title, status: stories.status })
    .from(stories)
    .where(inArray(stories.status, [...statuses]))
    .orderBy(desc(stories.createdAt))
    .limit(LIST_LIMIT)

  const heading = category === 'unread' ? 'Новые и на вычитке:' : 'Прочитанные:'
  const text = formatStoriesList(rows, heading)

  if (rows.length === 0) {
    await ctx.reply(text)
    return
  }

  const kb = new InlineKeyboard()

  for (const row of rows) {
    kb.text(storyLabel(row).slice(0, 60), `story:${row.id}`).row()
  }

  await ctx.reply(text, { reply_markup: kb })
}

async function showStory(ctx: Context, storyId: number): Promise<void> {
  const [story] = await db
    .select({
      title: stories.title,
      status: stories.status,
      textFinal: stories.textFinal,
      textV1: stories.textV1,
      textV2: stories.textV2,
    })
    .from(stories)
    .where(eq(stories.id, storyId))

  if (!story) {
    await ctx.reply(`История №${storyId} не найдена. Нажми /stories, чтобы увидеть список.`)
    return
  }

  const body = pickReadableText(story)

  if (!body) {
    await ctx.reply('История ещё генерируется, подожди немного ⏳')
    return
  }

  if (story.status === 'ready') {
    await db.update(stories).set({ status: 'read', updatedAt: new Date() }).where(eq(stories.id, storyId))
    await db.insert(storyReadings).values({ storyId })
  }

  const header = story.title && story.title.trim().length > 0 ? `📖 ${story.title}\n\n` : ''

  for (const chunk of chunkText(header + body)) {
    await ctx.reply(chunk)
  }

  await ctx.reply('Что дальше?', {
    reply_markup: new InlineKeyboard().text('← К списку', STORIES_MENU),
  })
}

export const bot: Bot<Context> | null = token ? new Bot<Context>(token) : null

if (bot) {
  registerStoryReadyCallback((storyId) => {
    bot!.api
      .sendMessage(allowedUserId, `Сказка №${storyId} готова! Отправь «${storyId}», чтобы прочитать, или нажми /stories.`)
      .catch((err) => {
        console.error('[telegram] failed to send story-ready notification:', err)
      })
  })

  bot.command('start', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return

    await ctx.reply(
      'Привет! 👋\n\n' +
        '• Создать сказку — пришли мне её идею одним сообщением (или нажми /new).\n' +
        '• Почитать — нажми /stories и выбери список.',
    )
  })

  bot.command('new', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return

    await ctx.reply('Опиши идею новой сказки одним сообщением 👇')
  })

  bot.command('stories', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return

    await sendCategoryMenu(ctx)
  })

  bot.callbackQuery(CATEGORY_UNREAD, async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) {
      await ctx.answerCallbackQuery()
      return
    }

    await ctx.answerCallbackQuery()
    await sendStoriesByCategory(ctx, 'unread')
  })

  bot.callbackQuery(CATEGORY_READ, async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) {
      await ctx.answerCallbackQuery()
      return
    }

    await ctx.answerCallbackQuery()
    await sendStoriesByCategory(ctx, 'read')
  })

  bot.callbackQuery(STORIES_MENU, async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) {
      await ctx.answerCallbackQuery()
      return
    }

    await ctx.answerCallbackQuery()
    await sendCategoryMenu(ctx)
  })

  bot.callbackQuery(/^story:\d+$/, async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) {
      await ctx.answerCallbackQuery()
      return
    }

    const storyId = Number.parseInt(ctx.callbackQuery.data.split(':')[1] ?? '0', 10)

    await ctx.answerCallbackQuery()
    await showStory(ctx, storyId)
  })

  bot.on('message:text', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return

    const text = ctx.message.text.trim()

    if (text.length === 0) return

    const maybeId = parseStoryIdMessage(text)

    if (maybeId !== null) {
      await showStory(ctx, maybeId)
      return
    }

    const storyId = await createStoryAndFire(text)

    if (storyId === null) {
      await ctx.reply('Не получилось создать сказку: сначала добавь вселенную в приложении.')
      return
    }

    await ctx.reply(`Генерирую сказку №${storyId} ✨ Пришлю, когда будет готова.`)
  })
}
