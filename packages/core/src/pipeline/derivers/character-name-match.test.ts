import { describe, it, expect } from 'vitest'
import { normalizeCharacterName, charactersMatch } from './character-name-match'

describe('normalizeCharacterName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeCharacterName('  Гоша  ')).toBe('гоша')
  })

  it('lowercases the name', () => {
    expect(normalizeCharacterName('ГОША')).toBe('гоша')
  })
})

describe('charactersMatch', () => {
  it('matches identical names', () => {
    expect(charactersMatch('Гоша', 'Гоша')).toBe(true)
  })

  it('matches names differing only by case', () => {
    expect(charactersMatch('гоша', 'ГОША')).toBe(true)
  })

  it('matches names differing only by surrounding whitespace', () => {
    expect(charactersMatch(' Гоша ', 'Гоша')).toBe(true)
  })

  it('does not match different names', () => {
    expect(charactersMatch('Гоша', 'Гошу')).toBe(false)
  })

  it('does not match unrelated names', () => {
    expect(charactersMatch('Гоша', 'Мила')).toBe(false)
  })
})
