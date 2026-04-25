import { describe, it, expect } from 'vitest'
import { deriveJoyPerDollar, type JoyPerDollarStoryRow } from './derive-joy-per-dollar'

describe('deriveJoyPerDollar', () => {
  it('returns empty list for no input', () => {
    expect(deriveJoyPerDollar([])).toEqual([])
  })

  it('excludes stories where totalUsdMicros = 0', () => {
    const rows: JoyPerDollarStoryRow[] = [
      { storyId: 1, models: ['m/a'], parentRating: 5, childEnjoyed: 5, totalUsdMicros: 0 },
    ]
    expect(deriveJoyPerDollar(rows)).toEqual([])
  })

  it('excludes stories without ratings (null)', () => {
    const rows: JoyPerDollarStoryRow[] = [
      { storyId: 1, models: ['m/a'], parentRating: null, childEnjoyed: 5, totalUsdMicros: 10000 },
      { storyId: 2, models: ['m/a'], parentRating: 5, childEnjoyed: null, totalUsdMicros: 10000 },
    ]
    expect(deriveJoyPerDollar(rows)).toEqual([])
  })

  it('averages joy-per-micro per model across stories that used it', () => {
    const rows: JoyPerDollarStoryRow[] = [
      { storyId: 1, models: ['m/a', 'm/b'], parentRating: 4, childEnjoyed: 4, totalUsdMicros: 10000 },
      { storyId: 2, models: ['m/a'], parentRating: 5, childEnjoyed: 5, totalUsdMicros: 20000 },
    ]

    const result = deriveJoyPerDollar(rows)

    const a = result.find((r) => r.model === 'm/a')!
    const b = result.find((r) => r.model === 'm/b')!

    expect(a.sampleSize).toBe(2)
    expect(a.avgJoyPerMicro).toBeCloseTo(((4 + 4) / 10000 + (5 + 5) / 20000) / 2, 10)
    expect(b.sampleSize).toBe(1)
    expect(b.avgJoyPerMicro).toBeCloseTo((4 + 4) / 10000, 10)
  })
})
