import { describe, it, expect } from 'vitest'
import { deriveSpendOverTime, type SpendCallRow } from './derive-spend-over-time'

describe('deriveSpendOverTime', () => {
  it('returns empty for empty input', () => {
    expect(deriveSpendOverTime([])).toEqual([])
  })

  it('groups calls by day and per model, sorted chronologically', () => {
    const rows: SpendCallRow[] = [
      { modelId: 'm/a', usdMicros: 1000, createdAt: new Date('2026-04-20T10:00:00Z') },
      { modelId: 'm/a', usdMicros: 2000, createdAt: new Date('2026-04-20T18:00:00Z') },
      { modelId: 'm/b', usdMicros: 5000, createdAt: new Date('2026-04-21T05:00:00Z') },
    ]

    const result = deriveSpendOverTime(rows)

    expect(result).toHaveLength(2)
    expect(result[0]?.date).toBe('2026-04-20')
    expect(result[0]?.totalUsdMicros).toBe(3000)
    expect(result[0]?.perModel).toEqual([{ model: 'm/a', usdMicros: 3000 }])
    expect(result[1]?.date).toBe('2026-04-21')
    expect(result[1]?.totalUsdMicros).toBe(5000)
  })
})
