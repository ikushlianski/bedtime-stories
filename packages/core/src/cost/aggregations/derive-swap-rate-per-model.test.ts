import { describe, it, expect } from 'vitest'
import { deriveSwapRatePerModel } from './derive-swap-rate-per-model'

describe('deriveSwapRatePerModel', () => {
  it('returns empty for no inputs', () => {
    expect(deriveSwapRatePerModel([], [])).toEqual([])
  })

  it('counts each model once per story even if reused across stages', () => {
    const result = deriveSwapRatePerModel(
      [],
      [{ storyId: 1, models: ['m/a', 'm/a', 'm/b'] }, { storyId: 2, models: ['m/a'] }],
    )
    expect(result).toEqual([
      { model: 'm/a', swapsAway: 0, totalUses: 2, swapRate: 0 },
      { model: 'm/b', swapsAway: 0, totalUses: 1, swapRate: 0 },
    ])
  })

  it('computes swap rate as swapsAway / totalUses', () => {
    const result = deriveSwapRatePerModel(
      [{ storyId: 1, fromModel: 'm/a' }, { storyId: 2, fromModel: 'm/a' }],
      [
        { storyId: 1, models: ['m/a'] },
        { storyId: 2, models: ['m/a'] },
        { storyId: 3, models: ['m/a'] },
        { storyId: 4, models: ['m/a'] },
      ],
    )

    const a = result.find((r) => r.model === 'm/a')!
    expect(a).toEqual({ model: 'm/a', swapsAway: 2, totalUses: 4, swapRate: 0.5 })
  })
})
