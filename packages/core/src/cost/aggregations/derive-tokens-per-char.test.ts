import { describe, it, expect } from 'vitest'
import { deriveTokensPerChar } from './derive-tokens-per-char'

describe('deriveTokensPerChar', () => {
  it('returns empty for empty input', () => {
    expect(deriveTokensPerChar([])).toEqual([])
  })

  it('divides tokens by chars per model', () => {
    const result = deriveTokensPerChar([
      { model: 'm/a', sumTokensOut: 1000, sumOutputChars: 4000 },
      { model: 'm/b', sumTokensOut: 500, sumOutputChars: 2500 },
    ])
    expect(result).toEqual([
      { model: 'm/a', tokensPerChar: 0.25 },
      { model: 'm/b', tokensPerChar: 0.2 },
    ])
  })

  it('returns null tokensPerChar when sumOutputChars = 0', () => {
    const result = deriveTokensPerChar([{ model: 'm/a', sumTokensOut: 0, sumOutputChars: 0 }])
    expect(result).toEqual([{ model: 'm/a', tokensPerChar: null }])
  })
})
