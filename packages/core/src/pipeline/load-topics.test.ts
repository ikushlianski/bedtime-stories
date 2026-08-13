import { describe, it, expect, vi } from 'vitest'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { topics } from '../db/schema'

const selectMock = vi.fn()

vi.mock('../db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}))

const { loadEligibleTopics, loadTopicsByIds } = await import('./load-topics')

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

describe('loadTopicsByIds', () => {
  it('returns an empty array without querying the db when given no ids', async () => {
    selectMock.mockClear()

    const rows = await loadTopicsByIds([])

    expect(rows).toEqual([])
    expect(selectMock).not.toHaveBeenCalled()
  })

  it('scopes the query to active topics matching the given ids', async () => {
    let capturedWhere: unknown

    const topicsChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn((condition: unknown) => {
        capturedWhere = condition
        return Promise.resolve([{ id: 1, title: 'T1', note: null, rank: 0, usedCount: 0 }])
      }),
    }

    selectMock.mockReturnValueOnce(topicsChain)

    const rows = await loadTopicsByIds([1, 2])

    expect(capturedWhere).toEqual(and(eq(topics.status, 'active'), inArray(topics.id, [1, 2])))
    expect(rows).toEqual([{ id: 1, title: 'T1', note: null, rank: 0, usedCount: 0 }])
  })
})
