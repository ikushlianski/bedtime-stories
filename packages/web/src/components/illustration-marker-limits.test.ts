import { describe, it, expect } from 'vitest'
import { ILLUSTRATION_MARKER_LIMIT, isIllustrationMarkerLimitReached } from './illustration-marker-limits'

describe('isIllustrationMarkerLimitReached', () => {
  it('matches the backend cap of 6', () => {
    expect(ILLUSTRATION_MARKER_LIMIT).toBe(6)
  })

  it('is false below the cap', () => {
    expect(isIllustrationMarkerLimitReached(0)).toBe(false)
    expect(isIllustrationMarkerLimitReached(ILLUSTRATION_MARKER_LIMIT - 1)).toBe(false)
  })

  it('is true once the cap is reached or exceeded', () => {
    expect(isIllustrationMarkerLimitReached(ILLUSTRATION_MARKER_LIMIT)).toBe(true)
    expect(isIllustrationMarkerLimitReached(ILLUSTRATION_MARKER_LIMIT + 1)).toBe(true)
  })
})
