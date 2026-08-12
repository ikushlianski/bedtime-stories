import { describe, it, expect, vi } from 'vitest'
import { eq, and, isNull } from 'drizzle-orm'
import { topics } from '../db/schema'

const selectMock = vi.fn()

vi.mock('../db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}))

const { loadEligibleTopics } = await import('./load-topics')

describe('loadEligibleTopics', () => {
  it('scopes the query to active topics only, excluding suggested ones', async () => {
    let capturedWhere: unknown

    const existingCountChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 0 }]),
    }

    const topicsChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn((condition: unknown) => {
        capturedWhere = condition
        return topicsChain
      }),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }

    selectMock.mockReturnValueOnce(existingCountChain).mockReturnValueOnce(topicsChain)

    await loadEligibleTopics([], 1)

    expect(capturedWhere).toEqual(and(eq(topics.status, 'active'), isNull(topics.universeId)))
  })
})
