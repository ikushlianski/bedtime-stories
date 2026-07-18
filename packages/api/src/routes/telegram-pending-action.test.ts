import { describe, it, expect, vi } from 'vitest'

vi.mock('@bedtime/core/db/client.js', () => ({
  db: {},
}))

import { buildPendingActionUpsert, isPendingActionExpired, PENDING_ACTION_TTL_MS } from './telegram-pending-action'

describe('buildPendingActionUpsert', () => {
  it('maps chatId, universeId and the given timestamp into the upsert row', () => {
    const now = new Date('2026-07-15T12:00:00.000Z')

    expect(buildPendingActionUpsert(823813562, 5, now)).toEqual({
      chatId: 823813562,
      universeId: 5,
      createdAt: now,
    })
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
