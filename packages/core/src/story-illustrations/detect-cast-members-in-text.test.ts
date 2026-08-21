import { describe, it, expect } from 'vitest'
import { detectCastMembersInText } from './detect-cast-members-in-text'

describe('detectCastMembersInText', () => {
  const cast = [
    { id: 1, name: 'Гоша' },
    { id: 2, name: 'Лиса Соня' },
  ]

  it('detects a cast member mentioned by name, case-insensitively', () => {
    const result = detectCastMembersInText({ text: 'гоша побежал к реке', cast })

    expect(result.matchedCharacterIds).toEqual([1])
  })

  it('detects multiple cast members mentioned in the same passage', () => {
    const result = detectCastMembersInText({ text: 'Гоша и Лиса Соня встретились у реки', cast })

    expect(result.matchedCharacterIds).toEqual([1, 2])
  })

  it('does not match a character referred to only by pronoun', () => {
    const result = detectCastMembersInText({ text: 'Он побежал к реке и она засмеялась', cast })

    expect(result.matchedCharacterIds).toEqual([])
  })

  it('returns no matches when the cast list is empty', () => {
    const result = detectCastMembersInText({ text: 'Гоша побежал к реке', cast: [] })

    expect(result.matchedCharacterIds).toEqual([])
  })
})
