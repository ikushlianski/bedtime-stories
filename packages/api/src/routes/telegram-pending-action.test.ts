import { describe, it, expect, vi } from 'vitest'

const { returning, update } = vi.hoisted(() => {
  const returning = vi.fn()
  const where = vi.fn(() => ({ returning }))
  const set = vi.fn(() => ({ where }))
  const update = vi.fn(() => ({ set }))

  return { returning, update }
})

vi.mock('@bedtime/core/db/client.js', () => ({
  db: { update },
}))

import { appendPendingSeedText, buildPendingActionUpsert, isPendingActionExpired, isReadyToFinalize, PENDING_ACTION_TTL_MS } from './telegram-pending-action'

describe('buildPendingActionUpsert', () => {
  it('maps chatId, universeId and the given timestamp into the upsert row, defaulting accumulation to null', () => {
    const now = new Date('2026-07-15T12:00:00.000Z')

    expect(buildPendingActionUpsert(823813562, 5, now)).toEqual({
      chatId: 823813562,
      universeId: 5,
      accumulatedSeed: null,
      createdAt: now,
    })
  })

  it('carries a given accumulatedSeed through instead of resetting it', () => {
    const now = new Date('2026-07-15T12:00:00.000Z')

    expect(buildPendingActionUpsert(823813562, 5, now, 'Гоша боится темноты')).toEqual({
      chatId: 823813562,
      universeId: 5,
      accumulatedSeed: 'Гоша боится темноты',
      createdAt: now,
    })
  })
})

describe('appendPendingSeedText', () => {
  it('trims the new text and issues a single atomic update, returning the row it wrote', async () => {
    returning.mockResolvedValueOnce([{ accumulatedSeed: 'Гоша боится темноты\nОн ночует у бабушки' }])

    const result = await appendPendingSeedText(823813562, '  Он ночует у бабушки  ')

    expect(update).toHaveBeenCalledTimes(1)
    expect(result).toBe('Гоша боится темноты\nОн ночует у бабушки')
  })

  it('falls back to the trimmed text itself when no row comes back', async () => {
    returning.mockResolvedValueOnce([])

    const result = await appendPendingSeedText(823813562, '  Первая идея  ')

    expect(result).toBe('Первая идея')
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
