import { describe, it, expect } from 'vitest'
import { buildWordsBlock, extractWordMarkers, MAX_WORDS_PER_STORY } from './words-block'
import type { TargetWord } from './words-block'

const word = (over: Partial<TargetWord> = {}): TargetWord => ({
  id: 1,
  word: 'щедрость',
  hint: 'готовность делиться',
  rank: 0,
  usedCount: 0,
  ...over,
})

describe('buildWordsBlock', () => {
  it('returns an empty string for no words', () => {
    expect(buildWordsBlock([])).toBe('')
  })

  it('renders word and hint after an em-dash', () => {
    const block = buildWordsBlock([word({ id: 12 })])

    expect(block).toContain('[Слово #12] щедрость — готовность делиться')
  })

  it('omits the em-dash when the hint is null', () => {
    const block = buildWordsBlock([word({ id: 5, word: 'терпение', hint: null })])

    expect(block).toContain('[Слово #5] терпение')
    expect(block).not.toContain('терпение —')
  })

  it('marks a previously used word', () => {
    const block = buildWordsBlock([word({ id: 7, usedCount: 2 })])

    expect(block).toContain('[Слово #7 (уже использовано ранее)]')
  })

  it('states the mandatory final service line and the max limit', () => {
    const block = buildWordsBlock([word()])

    expect(block).toContain('СЛОВА:')
    expect(block).toContain('целевые слова из списка')
    expect(block).toContain('нет')
    expect(block).toContain(String(MAX_WORDS_PER_STORY))
  })
})

describe('extractWordMarkers', () => {
  it('parses a comma-separated id list on the last line', () => {
    const result = extractWordMarkers('Жила-была история.\nСЛОВА: 3, 7')

    expect(result.wordIds).toEqual([3, 7])
    expect(result.cleanedText).toBe('Жила-была история.')
    expect(result.cleanedText).not.toContain('СЛОВА')
  })

  it('treats нет as zero words and strips the marker', () => {
    const result = extractWordMarkers('Тихий вечер.\nСЛОВА: нет')

    expect(result.wordIds).toEqual([])
    expect(result.cleanedText).toBe('Тихий вечер.')
    expect(result.cleanedText).not.toContain('СЛОВА')
  })

  it('keeps prose that merely starts with the word Слова and strips only the real marker', () => {
    const text = 'Слова застряли у него в горле.\nОн замолчал.\nСЛОВА: 5'
    const result = extractWordMarkers(text)

    expect(result.wordIds).toEqual([5])
    expect(result.cleanedText).toContain('Слова застряли у него в горле.')
    expect(result.cleanedText).toContain('Он замолчал.')
    expect(result.cleanedText).not.toContain('СЛОВА: 5')
  })

  it('leaves text untouched when there is no marker', () => {
    const text = 'История без служебной строки.\nСлово за слово, и разговор затянулся.'
    const result = extractWordMarkers(text)

    expect(result.wordIds).toEqual([])
    expect(result.cleanedText).toBe(text)
  })

  it('dedupes repeated ids', () => {
    const result = extractWordMarkers('Текст.\nСЛОВА: 4, 4, 9')

    expect(result.wordIds).toEqual([4, 9])
  })

  it('maps emitted words back to ids using the target list (the real model behavior)', () => {
    const words: TargetWord[] = [
      word({ id: 2, word: 'щедрость' }),
      word({ id: 8, word: 'терпение' }),
    ]
    const result = extractWordMarkers('...и это было больше, чем пять яблок.\nСЛОВА: щедрость', words)

    expect(result.wordIds).toEqual([2])
    expect(result.cleanedText).not.toContain('СЛОВА')
    expect(result.cleanedText).toContain('пять яблок')
  })

  it('maps a comma-separated word list, case- and punctuation-insensitive', () => {
    const words: TargetWord[] = [
      word({ id: 2, word: 'щедрость' }),
      word({ id: 8, word: 'Терпение' }),
    ]
    const result = extractWordMarkers('Текст.\nСЛОВА: «Щедрость», терпение.', words)

    expect(result.wordIds).toEqual([2, 8])
  })

  it('does NOT strip a word marker when no target list is supplied (unknown payload stays as prose)', () => {
    const text = 'Финал.\nСЛОВА: щедрость'
    const result = extractWordMarkers(text)

    expect(result.wordIds).toEqual([])
    expect(result.cleanedText).toBe(text)
  })

  it('does NOT strip a prose last line that starts with Слова and an em-dash', () => {
    const words: TargetWord[] = [word({ id: 2, word: 'щедрость' })]
    const text = 'Он задумался.\nСлова — это важно для каждого.'
    const result = extractWordMarkers(text, words)

    expect(result.wordIds).toEqual([])
    expect(result.cleanedText).toBe(text)
  })
})
