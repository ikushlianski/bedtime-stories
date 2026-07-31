import { describe, expect, it } from 'vitest'
import { deriveRecallAtK } from './eval-recall'

describe('deriveRecallAtK', () => {
  it('returns 1 when the sole expected id is within the top-k slice', () => {
    const recall = deriveRecallAtK([108, 42, 7], [108], 3)

    expect(recall).toBe(1)
  })

  it('returns a fractional value when only some of several acceptable ids are within top-k', () => {
    const recall = deriveRecallAtK([1, 2, 3, 4, 5], [3, 99, 100], 5)

    expect(recall).toBeCloseTo(1 / 3)
  })

  it('returns 0 when none of the expected ids are within top-k', () => {
    const recall = deriveRecallAtK([1, 2, 3], [99], 3)

    expect(recall).toBe(0)
  })

  it('only considers the top-k slice of rankedIds, not the full ranking', () => {
    const recall = deriveRecallAtK([1, 2, 3, 108], [108], 3)

    expect(recall).toBe(0)
  })

  it('returns 0 when expectedIds is empty', () => {
    const recall = deriveRecallAtK([1, 2, 3], [], 3)

    expect(recall).toBe(0)
  })

  it('handles k larger than rankedIds length by using the full ranking', () => {
    const recall = deriveRecallAtK([1, 2], [2], 10)

    expect(recall).toBe(1)
  })
})
