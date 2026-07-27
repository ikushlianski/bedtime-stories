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

vi.mock('./telegram-pending-action.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./telegram-pending-action.js')>()

  return {
    ...actual,
    setPendingUniverseChoice: vi.fn(() => Promise.resolve()),
    peekPendingAction: vi.fn(() => Promise.resolve(null)),
    appendPendingSeedText: vi.fn(() => Promise.resolve('')),
    consumePendingAction: vi.fn(() => Promise.resolve(null)),
  }
})

vi.mock('./pipeline-dispatch.js', () => ({
  dispatchAutoPipeline: vi.fn(() => Promise.resolve()),
}))

vi.mock('./pipeline-notifications.js', () => ({
  registerStoryReadyCallback: vi.fn(),
}))

const { bot } = await import('./telegram.js')
const { db } = await import('@bedtime/core/db/client.js')
const { peekPendingAction, appendPendingSeedText, consumePendingAction, setPendingUniverseChoice } = await import(
  './telegram-pending-action.js'
)

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
    vi.mocked(peekPendingAction).mockReset().mockResolvedValue(null)
    vi.mocked(appendPendingSeedText).mockReset().mockResolvedValue('')
    vi.mocked(consumePendingAction).mockReset().mockResolvedValue(null)
    vi.mocked(setPendingUniverseChoice).mockClear()
    vi.mocked(db.insert).mockClear()
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

    expect(vi.mocked(setPendingUniverseChoice)).toHaveBeenCalledWith(CHAT_ID, 5, null)

    const answered = calls.find((c) => c.method === 'answerCallbackQuery')
    expect(answered).toBeDefined()

    const prompt = calls.find((c) => c.method === 'sendMessage')
    expect(prompt!.payload['text']).toContain('Опиши идею')
    expect(prompt!.payload['text']).toContain('Готово')
  })

  it('carries an already-accumulated seed forward when the universe is re-picked mid-conversation', async () => {
    vi.mocked(peekPendingAction).mockResolvedValue({ universeId: 1, accumulatedSeed: 'Гоша идёт в лес' })
    const calls = await setUpBot()

    await bot!.handleUpdate(callbackQueryUpdate(10, 'newpick:5'))

    expect(vi.mocked(setPendingUniverseChoice)).toHaveBeenCalledWith(CHAT_ID, 5, 'Гоша идёт в лес')

    const prompt = calls.find((c) => c.method === 'sendMessage')
    expect(prompt!.payload['text']).toContain('сохранено')
  })

  it('keeps the existing id-lookup behavior for plain text when there is no pending action', async () => {
    dbState.storyRow = undefined
    const calls = await setUpBot()

    await bot!.handleUpdate(baseMessageUpdate(2, '42'))

    expect(vi.mocked(peekPendingAction)).toHaveBeenCalledWith(CHAT_ID)
    expect(vi.mocked(appendPendingSeedText)).not.toHaveBeenCalled()

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('История №42 не найдена')
  })

  it('accumulates a message instead of firing the pipeline when a pending action exists', async () => {
    vi.mocked(peekPendingAction).mockResolvedValue({ universeId: 5, accumulatedSeed: null })
    vi.mocked(appendPendingSeedText).mockResolvedValue('42')
    const calls = await setUpBot()

    await bot!.handleUpdate(baseMessageUpdate(4, '42'))

    expect(vi.mocked(appendPendingSeedText)).toHaveBeenCalledWith(CHAT_ID, '42')
    expect(dbState.insertedStory).toBeUndefined()

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('Добавлено')

    const keyboard = reply!.payload['reply_markup'] as { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> }
    expect(keyboard.inline_keyboard).toEqual([[{ text: '✅ Готово', callback_data: 'newgo' }]])
  })

  it('accumulates a second message on top of the first', async () => {
    vi.mocked(peekPendingAction).mockResolvedValue({ universeId: 5, accumulatedSeed: 'первое сообщение' })
    vi.mocked(appendPendingSeedText).mockResolvedValue('первое сообщение\nвторое сообщение')
    await setUpBot()

    await bot!.handleUpdate(baseMessageUpdate(5, 'второе сообщение'))

    expect(vi.mocked(appendPendingSeedText)).toHaveBeenCalledWith(CHAT_ID, 'второе сообщение')
  })

  it('tells the parent to finalize instead of accumulating once the seed is long enough', async () => {
    vi.mocked(peekPendingAction).mockResolvedValue({ universeId: 5, accumulatedSeed: 'а'.repeat(3995) })
    const calls = await setUpBot()

    await bot!.handleUpdate(baseMessageUpdate(11, 'ещё немного текста'))

    expect(vi.mocked(appendPendingSeedText)).not.toHaveBeenCalled()

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('Готово')
  })

  it('finalizes via the "Готово" callback, firing the pipeline with the full accumulated seed', async () => {
    vi.mocked(consumePendingAction).mockResolvedValue({
      universeId: 5,
      accumulatedSeed: 'первое сообщение\nвторое сообщение',
    })
    const calls = await setUpBot()

    await bot!.handleUpdate(callbackQueryUpdate(6, 'newgo'))

    expect(dbState.insertedStory).toMatchObject({ groupId: 5, seed: 'первое сообщение\nвторое сообщение' })

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('Генерирую сказку №77')
  })

  it('finalizes via the /go command exactly like the callback', async () => {
    vi.mocked(consumePendingAction).mockResolvedValue({ universeId: 1, accumulatedSeed: 'идея через команду' })
    const calls = await setUpBot()

    await bot!.handleUpdate(baseMessageUpdate(7, '/go'))

    expect(dbState.insertedStory).toMatchObject({ groupId: 1, seed: 'идея через команду' })

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('Генерирую сказку №77')
  })

  it('is a no-op and keeps the pending action alive when finalizing with nothing accumulated', async () => {
    vi.mocked(consumePendingAction).mockResolvedValue({ universeId: 5, accumulatedSeed: null })
    const calls = await setUpBot()

    await bot!.handleUpdate(callbackQueryUpdate(8, 'newgo'))

    expect(dbState.insertedStory).toBeUndefined()
    expect(vi.mocked(setPendingUniverseChoice)).toHaveBeenCalledWith(CHAT_ID, 5, null)

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('Сначала опиши идею')
  })

  it('restores the pending action instead of losing the accumulated seed when the story insert fails', async () => {
    vi.mocked(consumePendingAction).mockResolvedValue({
      universeId: 5,
      accumulatedSeed: 'первое сообщение\nвторое сообщение',
    })
    vi.mocked(db.insert).mockImplementationOnce(() => {
      throw new Error('connection dropped')
    })
    const calls = await setUpBot()

    await expect(bot!.handleUpdate(callbackQueryUpdate(12, 'newgo'))).rejects.toThrow('connection dropped')

    expect(vi.mocked(setPendingUniverseChoice)).toHaveBeenCalledWith(
      CHAT_ID,
      5,
      'первое сообщение\nвторое сообщение',
    )

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('текст сохранён')
  })

  it('tells the parent to /new first when finalizing with no pending action at all', async () => {
    vi.mocked(consumePendingAction).mockResolvedValue(null)
    const calls = await setUpBot()

    await bot!.handleUpdate(baseMessageUpdate(9, '/go'))

    expect(dbState.insertedStory).toBeUndefined()

    const reply = calls.find((c) => c.method === 'sendMessage')
    expect(reply!.payload['text']).toContain('/new')
  })
})
