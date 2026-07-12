import { describe, it, expect } from 'vitest'
import { buildCharacterBibleBlock, type CharacterBibleEntry } from './character-bible-block'

describe('buildCharacterBibleBlock', () => {
  describe('when the roster is empty', () => {
    it('returns an empty string so the soft lens boundary stays the only gate', () => {
      expect(buildCharacterBibleBlock([])).toBe('')
    })
  })

  describe('when no character has a structured field filled (not opted in)', () => {
    it('returns an empty string for name-only entries so existing universes keep prior behavior', () => {
      expect(buildCharacterBibleBlock([{ name: 'Гоша' }, { name: 'Мира' }])).toBe('')
    })

    it('returns an empty string when only the freeform description is present', () => {
      expect(buildCharacterBibleBlock([{ name: 'Гоша', description: 'главный герой' }])).toBe('')
    })
  })

  describe('when the roster has characters', () => {
    const roster: CharacterBibleEntry[] = [
      {
        name: 'Гоша',
        age: '5 лет',
        setting: 'старшая группа садика',
        traits: 'любопытный, упрямый',
        relationships: 'старший брат Мити',
        coOccurrenceNote: 'не в одной сцене со школьниками',
        description: 'главный герой',
      },
    ]

    it('renders each present structured field with its value', () => {
      const block = buildCharacterBibleBlock(roster)

      expect(block).toContain('Гоша')
      expect(block).toContain('5 лет')
      expect(block).toContain('старшая группа садика')
      expect(block).toContain('любопытный, упрямый')
      expect(block).toContain('старший брат Мити')
      expect(block).toContain('не в одной сцене со школьниками')
      expect(block).toContain('главный герой')
    })

    it('renders each character in a multi-character roster', () => {
      const block = buildCharacterBibleBlock([
        { name: 'Гоша', age: '5 лет' },
        { name: 'Митя', age: 'грудничок' },
      ])

      expect(block).toContain('Гоша')
      expect(block).toContain('Митя')
      expect(block).toContain('грудничок')
    })
  })

  describe('when fields are null or blank', () => {
    it('omits absent fields without leaving a dangling label', () => {
      const block = buildCharacterBibleBlock([
        { name: 'Тихон', age: null, setting: '   ', traits: 'тихий' },
      ])

      expect(block).toContain('Тихон')
      expect(block).toContain('тихий')
      expect(block).not.toContain('Возраст:')
      expect(block).not.toContain('Где/группа:')
    })
  })

  describe('the hard rule text', () => {
    const block = buildCharacterBibleBlock([{ name: 'Гоша', setting: 'старшая группа садика' }])

    it('states the use-ONLY-these gate', () => {
      expect(block).toContain('ТОЛЬКО')
      expect(block).toContain('ЖЁСТКОЕ ПРАВИЛО')
    })

    it('permits un-named incidental background figures', () => {
      expect(block).toContain('РАЗРЕШЕНО')
      expect(block).toContain('водитель автобуса')
    })
  })
})
