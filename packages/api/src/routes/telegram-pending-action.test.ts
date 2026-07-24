import { describe, it, expect, vi } from 'vitest'

vi.mock('@bedtime/core/db/client.js', () => ({
  db: {},
}))

import {
  appendToAccumulatedSeed,
  buildPendingActionUpsert,
  isPendingActionExpired,
  isReadyToFinalize,
  PENDING_ACTION_TTL_MS,
} from './telegram-pending-action'

describe('buildPendingActionUpsert', () => {
  it('maps chatId, universeId and the given timestamp into the upsert row, resetting accumulation', () => {
    const now = new Date('2026-07-15T12:00:00.000Z')

    expect(buildPendingActionUpsert(823813562, 5, now)).toEqual({
      chatId: 823813562,
      universeId: 5,
      accumulatedSeed: null,
      createdAt: now,
    })
  })
})

describe('appendToAccumulatedSeed', () => {
  it('uses the trimmed message as-is when nothing was accumulated yet', () => {
    expect(appendToAccumulatedSeed(null, '  Гоша боится темноты  ')).toBe('Гоша боится темноты')
  })

  it('treats an empty-string accumulator the same as null', () => {
    expect(appendToAccumulatedSeed('', 'Первая идея')).toBe('Первая идея')
  })

  it('appends the trimmed new message on its own line', () => {
    expect(appendToAccumulatedSeed('Гоша боится темноты', 'Он ночует у бабушки')).toBe(
      'Гоша боится темноты\nОн ночует у бабушки',
    )
  })

  it('keeps appending across more than two messages', () => {
    const first = appendToAccumulatedSeed(null, 'Сообщение 1')
    const second = appendToAccumulatedSeed(first, 'Сообщение 2')
    const third = appendToAccumulatedSeed(second, 'Сообщение 3')

    expect(third).toBe('Сообщение 1\nСообщение 2\nСообщение 3')
  })
})

describe('isReadyToFinalize', () => {
  it('returns false when nothing has been accumulated', () => {
    expect(isReadyToFinalize(null)).toBe(false)
  })

  it('returns false for a whitespace-only accumulator', () => {
    expect(isReadyToFinalize('   \n  ')).toBe(false)
  })

  it('returns true once real text has been accumulated', () => {
    expect(isReadyToFinalize('Гоша боится темноты')).toBe(true)
  })
})

describe('isPendingActionExpired', () => {
  it('returns false when the elapsed time is under the ttl', () => {
    const createdAt = new Date('2026-07-15T12:00:00.000Z')
    const now = new Date('2026-07-15T12:10:00.000Z')

    expect(isPendingActionExpired(createdAt, now, PENDING_ACTION_TTL_MS)).toBe(false)
  })

  it('returns true when the elapsed time exceeds the ttl', () => {
    const createdAt = new Date('2026-07-15T12:00:00.000Z')
    const now = new Date('2026-07-15T13:00:00.000Z')

    expect(isPendingActionExpired(createdAt, now, PENDING_ACTION_TTL_MS)).toBe(true)
  })

  it('treats the exact ttl boundary as not yet expired', () => {
    const createdAt = new Date('2026-07-15T12:00:00.000Z')
    const now = new Date(createdAt.getTime() + PENDING_ACTION_TTL_MS)

    expect(isPendingActionExpired(createdAt, now, PENDING_ACTION_TTL_MS)).toBe(false)
  })
})
