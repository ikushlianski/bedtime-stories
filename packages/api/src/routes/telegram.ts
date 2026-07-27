import { Bot, Context, InlineKeyboard } from 'grammy'
import { desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client.js'
import { stories, storyGroups, storyReadings, topics, fragments } from '@bedtime/core/db/schema.js'
import { deriveIsAuthorizedUser, deriveIdeaFromMessage, parseCommandArgument } from './telegram-utils.js'
import { setPendingUniverseChoice, consumePendingUniverseChoice } from './telegram-pending-action.js'
import {
  UNREAD_STATUSES,
  READ_STATUSES,
  parseStoryIdMessage,
  formatStoriesList,
  storyLabel,
  chunkText,
  pickReadableText,
} from './telegram-format.js'
import { dispatchAutoPipeline } from './pipeline-dispatch.js'
import { registerStoryReadyCallback } from './pipeline-notifications.js'
import { setStoryUniverses } from './story-universe-links.js'

export { deriveIsAuthorizedUser, deriveIdeaFromMessage }

const token = process.env['TELEGRAM_BOT_TOKEN']
const allowedUserId = Number(process.env['TELEGRAM_ALLOWED_USER_ID'] ?? '0')

const CATEGORY_UNREAD = 'cat:unread'
const CATEGORY_READ = 'cat:read'
const STORIES_MENU = 'stories:menu'
const NEW_PICK_PREFIX = 'newpick:'
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

async function insertAndDispatchStory(seedText: string, universeId: number): Promise<number> {
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

  await setStoryUniverses(storyId, [universeId])
  void dispatchAutoPipeline({
    storyId,
    seed: seedText,
    universeSystemPrompt: universe?.systemPrompt ?? undefined,
    universeContext: universe?.universeContext ?? undefined,
    styleGuide: universe?.styleGuide ?? undefined,
    universeIds: [universeId],
  }).catch((err) => {
    console.error(`Failed to dispatch auto pipeline for storyId=${storyId}:`, err)
  })

  return storyId
}

async function createStoryAndFire(seedText: string): Promise<number | null> {
  const universeId = await resolveDefaultUniverseId()

  if (universeId === null) {
    return null
  }

  return insertAndDispatchStory(seedText, universeId)
}

async function createStoryForUniverse(seedText: string, universeId: number): Promise<number> {
  return insertAndDispatchStory(seedText, universeId)
}

async function addTopic(title: string): Promise<boolean> {
  const universeId = await resolveDefaultUniverseId()

  if (universeId === null) {
    return false
  }

  await db.insert(topics).values({ title, note: null, universeId })

  return true
}

async function addFragment(text: string): Promise<boolean> {
  const universeId = await resolveDefaultUniverseId()

  if (universeId === null) {
    return false
  }

  await db.insert(fragments).values({ text, universeId })

  return true
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

async function sendUniversePicker(ctx: Context): Promise<void> {
  const universes = await db.select({ id: storyGroups.id, name: storyGroups.name }).from(storyGroups).orderBy(storyGroups.id)

  if (universes.length === 0) {
    await ctx.reply('Не получилось начать: сначала добавь вселенную в приложении.')
    return
  }

  const kb = new InlineKeyboard()

  for (const universe of universes) {
    kb.text(universe.name.slice(0, 60), `${NEW_PICK_PREFIX}${universe.id}`).row()
  }

  await ctx.reply('В какой вселенной новая сказка?', { reply_markup: kb })
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
  registerStoryReadyCallback((storyId, stage) => {
    const message =
      stage === 'generated'
        ? `Сказка №${storyId} сгенерирована и ждёт вычитки 📝 Отправь «${storyId}», чтобы прочитать, или нажми /stories → «Новые / на вычитке».`
        : `Сказка №${storyId} готова! Отправь «${storyId}», чтобы прочитать, или нажми /stories.`

    bot!.api
      .sendMessage(allowedUserId, message)
      .then(() => {
        console.log(`[telegram] story notification sent for story #${storyId} (stage=${stage})`)
      })
      .catch((err) => {
        console.error('[telegram] failed to send story notification:', err)
      })
  })

  bot.command('start', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return

    await ctx.reply(
      'Привет! 👋\n\n' +
        '• Создать сказку — пришли мне её идею одним сообщением (или нажми /new).\n' +
        '• Почитать — нажми /stories и выбери список.\n' +
        '• Добавить тему — /topic <текст темы>.\n' +
        '• Добавить фрагмент — /fragment <текст фрагмента>.',
    )
  })

  bot.command('topic', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return

    const title = parseCommandArgument(ctx.match)

    if (title === null) {
      await ctx.reply('Пришли так: /topic <текст темы>')
      return
    }

    const added = await addTopic(title)

    if (!added) {
      await ctx.reply('Не получилось добавить тему: сначала добавь вселенную в приложении.')
      return
    }

    await ctx.reply(`Тема добавлена: «${title}»`)
  })

  bot.command('fragment', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return

    const text = parseCommandArgument(ctx.match)

    if (text === null) {
      await ctx.reply('Пришли так: /fragment <текст фрагмента>')
      return
    }

    const added = await addFragment(text)

    if (!added) {
      await ctx.reply('Не получилось добавить фрагмент: сначала добавь вселенную в приложении.')
      return
    }

    await ctx.reply(`Фрагмент добавлен: «${text}»`)
  })

  bot.command('new', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return

    await sendUniversePicker(ctx)
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

  bot.callbackQuery(new RegExp(`^${NEW_PICK_PREFIX}\\d+$`), async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) {
      await ctx.answerCallbackQuery()
      return
    }

    const universeId = Number.parseInt(ctx.callbackQuery.data.slice(NEW_PICK_PREFIX.length), 10)

    await setPendingUniverseChoice(ctx.chat!.id, universeId)
    await ctx.answerCallbackQuery()
    await ctx.reply('Опиши идею новой сказки одним сообщением 👇')
  })

  bot.on('message:text', async (ctx) => {
    if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return

    const text = ctx.message.text.trim()

    if (text.length === 0) return

    const pendingUniverseId = await consumePendingUniverseChoice(ctx.chat.id)

    if (pendingUniverseId !== null) {
      const storyId = await createStoryForUniverse(text, pendingUniverseId)

      await ctx.reply(`Генерирую сказку №${storyId} ✨ Пришлю, когда будет готова.`)
      return
    }

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
