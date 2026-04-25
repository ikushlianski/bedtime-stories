import { describe, it, expect } from 'vitest'
import { toMicros, formatMicros, MICROS_PER_USD } from './micros'

describe('toMicros', () => {
  it('converts integer dollars exactly', () => {
    expect(toMicros(1)).toBe(MICROS_PER_USD)
    expect(toMicros(0)).toBe(0)
  })

  it('rounds sub-micro fractions', () => {
    expect(toMicros(0.0000001)).toBe(0)
    expect(toMicros(0.0000005)).toBe(1)
  })

  it('parses string inputs from OpenRouter', () => {
    expect(toMicros('0.00012345')).toBe(123)
    expect(toMicros('0.001')).toBe(1000)
  })

  it('returns null for invalid input so callers can flag bad cost data', () => {
    expect(toMicros('not a number')).toBeNull()
    expect(toMicros(NaN)).toBeNull()
    expect(toMicros(Infinity)).toBeNull()
  })
})

describe('formatMicros', () => {
  it('formats with default 4 decimals', () => {
    expect(formatMicros(1234)).toBe('0.0012')
    expect(formatMicros(MICROS_PER_USD)).toBe('1.0000')
  })

  it('respects custom decimals', () => {
    expect(formatMicros(1, 6)).toBe('0.000001')
  })
})
