import { describe, it, expect } from 'vitest'
import { matchCharacterNamesToCast } from './match-character-names-to-cast'

describe('matchCharacterNamesToCast', () => {
  const cast = [
    { id: 1, name: 'Гоша' },
    { id: 2, name: 'Лиса Соня' },
  ]

  it('matches a name case-insensitively and trimmed', () => {
    const result = matchCharacterNamesToCast({ characterNames: [' гоша ', 'ЛИСА СОНЯ'], cast })

    expect(result.matchedCharacterIds).toEqual([1, 2])
    expect(result.unmatchedNames).toEqual([])
  })

  it('drops an unmatched name instead of blocking the moment', () => {
    const result = matchCharacterNamesToCast({ characterNames: ['Гоша', 'Медведь Миша'], cast })

    expect(result.matchedCharacterIds).toEqual([1])
    expect(result.unmatchedNames).toEqual(['Медведь Миша'])
  })

  it('returns empty results for no names', () => {
    const result = matchCharacterNamesToCast({ characterNames: [], cast })

    expect(result.matchedCharacterIds).toEqual([])
    expect(result.unmatchedNames).toEqual([])
  })

  it('does not require an exact substring match — a partial name mismatches', () => {
    const result = matchCharacterNamesToCast({ characterNames: ['Лиса'], cast })

    expect(result.matchedCharacterIds).toEqual([])
    expect(result.unmatchedNames).toEqual(['Лиса'])
  })
})
