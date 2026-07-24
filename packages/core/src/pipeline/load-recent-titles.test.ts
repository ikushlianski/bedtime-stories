import { describe, expect, it, vi, beforeEach } from 'vitest'
import { loadRecentTitles } from './load-recent-titles'

let mockRows: Array<{ title: string }> = []

vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => mockRows),
          })),
        })),
      })),
    })),
  },
}))

describe('loadRecentTitles', () => {
  beforeEach(() => {
    mockRows = []
  })

  it('returns an empty list when universeId is null, without querying the db', async () => {
    mockRows = [{ title: 'Тайна ночного леса' }]

    const result = await loadRecentTitles(null)

    expect(result).toEqual([])
  })

  it('returns an empty list when the universe has no recent titles', async () => {
    mockRows = []

    const result = await loadRecentTitles(1)

    expect(result).toEqual([])
  })

  it('maps rows into a flat list of titles', async () => {
    mockRows = [
      { title: 'Тайна ночного леса' },
      { title: 'Приключение у реки' },
    ]

    const result = await loadRecentTitles(1)

    expect(result).toEqual(['Тайна ночного леса', 'Приключение у реки'])
  })
})
