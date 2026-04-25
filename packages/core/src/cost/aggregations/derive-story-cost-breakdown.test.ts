import { describe, it, expect } from 'vitest'
import { deriveStoryCostBreakdown, type ModelCallRow } from './derive-story-cost-breakdown'

const at = (ms: number): Date => new Date(ms)

describe('deriveStoryCostBreakdown', () => {
  it('returns zero total and empty rows for an empty input', () => {
    const result = deriveStoryCostBreakdown([])

    expect(result).toEqual({ totalUsdMicros: 0, perStage: [] })
  })

  it('sums usdMicros across all rows and returns per-stage entries ordered by created_at', () => {
    const rows: ModelCallRow[] = [
      { stage: 'writer', modelId: 'm/w', attempt: 1, tokensIn: 100, tokensOut: 200, usdMicros: 4000, createdAt: at(2000) },
      { stage: 'plotter', modelId: 'm/p', attempt: 1, tokensIn: 50, tokensOut: 80, usdMicros: 1000, createdAt: at(1000) },
      { stage: 'plotCritic', modelId: 'm/c', attempt: 1, tokensIn: 30, tokensOut: 10, usdMicros: 500, createdAt: at(1500) },
    ]

    const result = deriveStoryCostBreakdown(rows)

    expect(result.totalUsdMicros).toBe(5500)
    expect(result.perStage.map((r) => r.stage)).toEqual(['plotter', 'plotCritic', 'writer'])
    expect(result.perStage[0]).toMatchObject({ stage: 'plotter', model: 'm/p', tokensIn: 50, tokensOut: 80, usdMicros: 1000 })
  })

  it('lists multiple attempts of the same stage as separate rows', () => {
    const rows: ModelCallRow[] = [
      { stage: 'writer', modelId: 'preferred', attempt: 1, tokensIn: 0, tokensOut: 0, usdMicros: 0, createdAt: at(1000) },
      { stage: 'writer', modelId: 'fallback', attempt: 2, tokensIn: 100, tokensOut: 50, usdMicros: 1000, createdAt: at(1500) },
    ]

    const result = deriveStoryCostBreakdown(rows)

    expect(result.perStage).toHaveLength(2)
    expect(result.perStage[0]?.attempt).toBe(1)
    expect(result.perStage[1]?.attempt).toBe(2)
  })
})
