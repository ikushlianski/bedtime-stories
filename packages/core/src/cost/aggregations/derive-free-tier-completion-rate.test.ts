import { describe, it, expect } from 'vitest'
import { deriveFreeTierCompletionRate } from './derive-free-tier-completion-rate'

describe('deriveFreeTierCompletionRate', () => {
  it('returns zero rate for empty input', () => {
    expect(deriveFreeTierCompletionRate([])).toEqual({ rate: 0, freeOnlyStoryCount: 0, totalStoryCount: 0 })
  })

  it('counts only stories where every call usdMicros = 0 as free', () => {
    const result = deriveFreeTierCompletionRate([
      { storyId: 1, callUsdMicros: [0, 0, 0] },
      { storyId: 2, callUsdMicros: [1000, 0] },
      { storyId: 3, callUsdMicros: [0, 0] },
    ])
    expect(result).toEqual({ rate: 2 / 3, freeOnlyStoryCount: 2, totalStoryCount: 3 })
  })

  it('treats stories with no calls as not free', () => {
    const result = deriveFreeTierCompletionRate([
      { storyId: 1, callUsdMicros: [] },
      { storyId: 2, callUsdMicros: [0] },
    ])
    expect(result).toEqual({ rate: 0.5, freeOnlyStoryCount: 1, totalStoryCount: 2 })
  })
})
