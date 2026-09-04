import { describe, it, expect } from 'vitest'
import { buildCharacterBibleBlock, extractCharacterMarkers, type CharacterBibleEntry } from './character-bible-block'

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

  describe('importance', () => {
    it('sorts the roster by importance, most important first', () => {
      const block = buildCharacterBibleBlock([
        { name: 'Редкий', setting: 'изредка', importance: 1 },
        { name: 'Главный', setting: 'часто', importance: 5 },
        { name: 'Средний', setting: 'иногда', importance: 3 },
      ])

      expect(block.indexOf('Главный')).toBeLessThan(block.indexOf('Средний'))
      expect(block.indexOf('Средний')).toBeLessThan(block.indexOf('Редкий'))
    })

    it('defaults missing importance to 3 for sorting and labeling', () => {
      const block = buildCharacterBibleBlock([
        { name: 'БезВажности', setting: 'где-то' },
      ])

      expect(block).toContain('Важность: 3/5')
    })

    it('labels the 1-5 scale so the plotter knows how often to use a character', () => {
      const block = buildCharacterBibleBlock([{ name: 'Гоша', setting: 'x', importance: 5 }])

      expect(block).toContain('5/5')
      expect(block).toContain('появляется часто')
    })
  })

  describe('usage-based fairness', () => {
    it('sorts characters of equal importance by ascending usage count, least-used first', () => {
      const block = buildCharacterBibleBlock([
        { id: 1, name: 'Частый', setting: 'x', importance: 4, usedCount: 12 },
        { id: 2, name: 'Редкий', setting: 'x', importance: 4, usedCount: 1 },
      ])

      expect(block.indexOf('Редкий')).toBeLessThan(block.indexOf('Частый'))
    })

    it('annotates each character with its id and usage count when ids are present', () => {
      const block = buildCharacterBibleBlock([{ id: 7, name: 'Гоша', setting: 'x', usedCount: 3 }])

      expect(block).toContain('#7')
      expect(block).toContain('использован в 3 готовых историях')
    })

    it('adds the fairness instruction and marker request only when usage data is present', () => {
      const withIds = buildCharacterBibleBlock([{ id: 1, name: 'Гоша', setting: 'x' }])
      const withoutIds = buildCharacterBibleBlock([{ name: 'Гоша', setting: 'x' }])

      expect(withIds).toContain('ID_ПЕРСОНАЖЕЙ')
      expect(withIds).toContain('МЕНЬШИМ числом появлений')
      expect(withoutIds).not.toContain('ID_ПЕРСОНАЖЕЙ')
      expect(withoutIds).not.toContain('МЕНЬШИМ числом появлений')
    })

    it('renders the roster when characters have real DB ids even with no structured fields set (production shape)', () => {
      const block = buildCharacterBibleBlock([
        { id: 1, name: 'Гоша', description: 'главный герой', importance: 3 },
        { id: 2, name: 'Юра', description: 'друг', importance: 3 },
      ])

      expect(block).not.toBe('')
      expect(block).toContain('Гоша')
      expect(block).toContain('Юра')
      expect(block).toContain('ID_ПЕРСОНАЖЕЙ')
    })

    it('omits the marker request when includeMarker is false, for JSON-output callers', () => {
      const block = buildCharacterBibleBlock([{ id: 1, name: 'Гоша', setting: 'x' }], { includeMarker: false })

      expect(block).not.toContain('ID_ПЕРСОНАЖЕЙ')
      expect(block).toContain('#1')
    })
  })

  describe('extractCharacterMarkers', () => {
    it('extracts ids from a well-formed marker line and strips it from the text', () => {
      const { cleanedText, characterIds } = extractCharacterMarkers('план истории...\nID_ПЕРСОНАЖЕЙ: #3, #7')

      expect(characterIds).toEqual([3, 7])
      expect(cleanedText).not.toContain('ID_ПЕРСОНАЖЕЙ')
      expect(cleanedText).toContain('план истории...')
    })

    it('returns an empty array when the marker says нет', () => {
      const { characterIds } = extractCharacterMarkers('план истории...\nID_ПЕРСОНАЖЕЙ: нет')

      expect(characterIds).toEqual([])
    })

    it('returns an empty array and the original text when no marker is present', () => {
      const result = extractCharacterMarkers('план истории без маркера')

      expect(result.characterIds).toEqual([])
      expect(result.cleanedText).toBe('план истории без маркера')
    })

    it('deduplicates repeated ids', () => {
      const { characterIds } = extractCharacterMarkers('текст\nID_ПЕРСОНАЖЕЙ: 3, 3, 7')

      expect(characterIds).toEqual([3, 7])
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
