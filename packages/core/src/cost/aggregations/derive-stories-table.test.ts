import { describe, it, expect } from 'vitest'
import { deriveStoriesTable, type StoriesTableInputRow } from './derive-stories-table'

describe('deriveStoriesTable', () => {
  it('returns empty for empty input', () => {
    expect(deriveStoriesTable([])).toEqual([])
  })

  it('computes joyPerMicro when both ratings present and totalUsdMicros > 0', () => {
    const rows: StoriesTableInputRow[] = [
      {
        storyId: 1,
        title: 'A',
        createdAt: new Date('2026-04-20T10:00:00Z'),
        modelsPerStage: { plotter: 'm/p', writer: 'm/w' },
        totalTokens: 1500,
        totalUsdMicros: 10000,
        parentRating: 4,
        childRating: 5,
      },
    ]
    const result = deriveStoriesTable(rows)
    expect(result[0]?.joyPerMicro).toBeCloseTo((4 + 5) / 10000, 10)
    expect(result[0]?.date).toBe('2026-04-20')
  })

  it('returns null joyPerMicro when totalUsdMicros is 0 or null, or rating is missing', () => {
    const rows: StoriesTableInputRow[] = [
      {
        storyId: 1, title: 'no-usd', createdAt: null,
        modelsPerStage: {}, totalTokens: 0, totalUsdMicros: 0, parentRating: 4, childRating: 5,
      },
      {
        storyId: 2, title: 'no-usd-null', createdAt: null,
        modelsPerStage: {}, totalTokens: 0, totalUsdMicros: null, parentRating: 4, childRating: 5,
      },
      {
        storyId: 3, title: 'no-rating', createdAt: null,
        modelsPerStage: {}, totalTokens: 0, totalUsdMicros: 10000, parentRating: null, childRating: 5,
      },
    ]
    const result = deriveStoriesTable(rows)
    expect(result.map((r) => r.joyPerMicro)).toEqual([null, null, null])
  })
})
