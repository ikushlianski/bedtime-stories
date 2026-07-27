import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Update } from 'grammy/types'
import { storyGroups } from '@bedtime/core/db/schema.js'

process.env['TELEGRAM_BOT_TOKEN'] = 'test-token'
process.env['TELEGRAM_ALLOWED_USER_ID'] = '111'

const ALLOWED_USER_ID = 111
const CHAT_ID = 555

const dbState = {
  universes: [] as Array<{ id: number; name: string }>,
  storyRow: undefined as Record<string, unknown> | undefined,
  insertedStory: undefined as Record<string, unknown> | undefined,
}

vi.mock('@bedtime/core/db/client.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === storyGroups) {
          return {
            orderBy: vi.fn(() => Promise.resolve(dbState.universes)),
            where: vi.fn(() => Promise.resolve([])),
          }
        }

        return { where: vi.fn(() => Promise.resolve(dbState.storyRow ? [dbState.storyRow] : [])) }
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(() => {
          dbState.insertedStory = values
          return Promise.resolve([{ id: 77 }])
        }),
        onConflictDoNothing: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
}))

vi.mock('./telegram-pending-action.js', () => ({
  setPendingUniverseChoice: vi.fn(() => Promise.resolve()),
  consumePendingUniverseChoice: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('./pipeline-dispatch.js', () => ({
  dispatchAutoPipeline: vi.fn(() => Promise.resolve()),
}))

vi.mock('./pipeline-notifications.js', () => ({
  registerStoryReadyCallback: vi.fn(),
}))

const { bot } = await import('./telegram.js')
const { consumePendingUniverseChoice, setPendingUniverseChoice } = await import('./telegram-pending-action.js')

interface CapturedCall {
  method: string
  payload: Record<string, unknown>
}

function baseMessageUpdate(updateId: number, text: string): Update {
  const isCommand = text.startsWith('/')

  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 0,
      chat: { id: CHAT_ID, type: 'private' },
      from: { id: ALLOWED_USER_ID, is_bot: false, first_name: 'Ilya' },
      text,
      ...(isCommand
        ? { entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0]!.length }] }
        : {}),
    },
  } as unknown as Update
}

function callbackQueryUpdate(updateId: number, data: string): Update {
  return {
    update_id: updateId,
    callback_query: {
      id: String(updateId),
      chat_instance: 'x',
      data,
      from: { id: ALLOWED_USER_ID, is_bot: false, first_name: 'Ilya' },
      message: {
        message_id: updateId,
        date: 0,
        chat: { id: CHAT_ID, type: 'private' },
      },
    },
  } as unknown as Update
}

async function setUpBot(): Promise<CapturedCall[]> {
  const calls: CapturedCall[] = []

  bot!.api.config.use(async (_prev, method, payload) => {
    if (method === 'getMe') {
      return {
        ok: true,
        result: { id: 999, is_bot: true, first_name: 'test', username: 'test_bot' },
      } as never
    }

    calls.push({ method, payload: payload as Record<string, unknown> })

    return { ok: true, result: true } as never
  })

  await bot!.init()

  return calls
}

describe('telegram /new flow', () => {
  beforeEach(() => {
    dbState.universes = [
      { id: 1, name: 'Мира и Гоша' },
      { id: 5, name: 'Эмма' },
    ]
    dbState.storyRow = undefined
    dbState.insertedStory = undefined
    vi.mocked(consumePendingUniverseChoice).mockResolvedValue(null)
  })

  it('replies to /new with one inline keyboard row per universe', async () => {
    const calls = await setUpBot()

    await bot!.handleUpdate(baseMessageUpdate(1, '/new'))

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply).toBeDefined()

    const keyboard = reply!.payload['reply_markup'] as { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
    expect(keyboard.inline_keyboard).toEqual([
      [{ text: 'Мира и Гоша', callback_data: 'newpick:1' }],
      [{ text: 'Эмма', callback_data: 'newpick:5' }],
      [],
    ])
  })

  it('replies with an add-a-universe prompt when there are no universes', async () => {
    dbState.universes = []
    const calls = await setUpBot()

    await bot!.handleUpdate(baseMessageUpdate(1, '/new'))

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('вселенную')
    expect(reply!.payload['reply_markup']).toBeUndefined()
  })

  it('stores the picked universe and prompts for the outline when a universe button is tapped', async () => {
    const calls = await setUpBot()

    await bot!.handleUpdate(callbackQueryUpdate(3, 'newpick:5'))

    expect(vi.mocked(setPendingUniverseChoice)).toHaveBeenCalledWith(CHAT_ID, 5)

    const answered = calls.find((c) => c.method === 'answerCallbackQuery')
    expect(answered).toBeDefined()

    const prompt = calls.find((c) => c.method === 'sendMessage')
    expect(prompt!.payload['text']).toContain('Опиши идею')
  })

  it('keeps the existing id-lookup behavior for plain text when there is no pending universe choice', async () => {
    dbState.storyRow = undefined
    const calls = await setUpBot()

    await bot!.handleUpdate(baseMessageUpdate(2, '42'))

    expect(vi.mocked(consumePendingUniverseChoice)).toHaveBeenCalledWith(CHAT_ID)

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('История №42 не найдена')
  })

  it('treats a numeric-looking message as the seed when a pending universe choice exists, skipping id-lookup', async () => {
    vi.mocked(consumePendingUniverseChoice).mockResolvedValue(5)
    const calls = await setUpBot()

    await bot!.handleUpdate(baseMessageUpdate(4, '42'))

    expect(dbState.insertedStory).toMatchObject({ groupId: 5, seed: '42' })

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('Генерирую сказку №77')
  })
})
