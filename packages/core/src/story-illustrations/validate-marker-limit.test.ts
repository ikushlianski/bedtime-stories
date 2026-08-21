import { describe, it, expect } from 'vitest'
import { validateMarkerLimit, MARKER_LIMIT } from './validate-marker-limit'

describe('validateMarkerLimit', () => {
  it('allows a new mark when below the cap', () => {
    const result = validateMarkerLimit({ currentMarkerCount: 0 })

    expect(result.allowed).toBe(true)
  })

  it('allows the marker that brings the count exactly to the cap', () => {
    const result = validateMarkerLimit({ currentMarkerCount: MARKER_LIMIT - 1 })

    expect(result.allowed).toBe(true)
  })

  it('rejects a new mark once the cap is already reached', () => {
    const result = validateMarkerLimit({ currentMarkerCount: MARKER_LIMIT })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('rejects a new mark when the count already exceeds the cap', () => {
    const result = validateMarkerLimit({ currentMarkerCount: MARKER_LIMIT + 3 })

    expect(result.allowed).toBe(false)
  })
})
