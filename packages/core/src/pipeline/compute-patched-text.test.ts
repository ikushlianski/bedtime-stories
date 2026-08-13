import { describe, it, expect } from 'vitest'
import { computePatchedText } from './compute-patched-text'

describe('computePatchedText', () => {
  it('replaces the first occurrence of find with replace when it matches', () => {
    const result = computePatchedText({
      currentText: 'Дракон зарычал и напугал всех.',
      find: 'зарычал',
      replace: 'тихо вздохнул',
    })

    expect(result).toEqual({ ok: true, text: 'Дракон тихо вздохнул и напугал всех.' })
  })

  it('only replaces the first occurrence when find appears multiple times', () => {
    const result = computePatchedText({
      currentText: 'кот кот кот',
      find: 'кот',
      replace: 'пёс',
    })

    expect(result).toEqual({ ok: true, text: 'пёс кот кот' })
  })

  it('returns not_found when find does not appear in the current text', () => {
    const result = computePatchedText({
      currentText: 'Дракон зарычал.',
      find: 'единорог',
      replace: 'пони',
    })

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('returns not_found for an empty current text', () => {
    const result = computePatchedText({ currentText: '', find: 'x', replace: 'y' })

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('inserts the replacement literally when it contains $-substitution patterns', () => {
    const result = computePatchedText({
      currentText: 'Дракон зарычал и напугал всех.',
      find: 'зарычал',
      replace: 'сказал $& тихо, а $$ не при чём',
    })

    expect(result).toEqual({
      ok: true,
      text: 'Дракон сказал $& тихо, а $$ не при чём и напугал всех.',
    })
  })

  it('replaces the exact line at lineIndex, ignoring earlier duplicate text', () => {
    const currentText = 'Кот спал.\n\nПёс лаял.\n\nКот спал.'

    const result = computePatchedText({
      currentText,
      find: 'Кот спал.',
      replace: 'Кот проснулся.',
      lineIndex: 4,
    })

    expect(result).toEqual({
      ok: true,
      text: 'Кот спал.\n\nПёс лаял.\n\nКот проснулся.',
    })
  })

  it('returns not_found when lineIndex text no longer matches find', () => {
    const currentText = 'Кот спал.\n\nПёс лаял.'

    const result = computePatchedText({
      currentText,
      find: 'Кот спал.',
      replace: 'Кот проснулся.',
      lineIndex: 2,
    })

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('returns not_found when lineIndex is out of range', () => {
    const result = computePatchedText({
      currentText: 'Кот спал.',
      find: 'Кот спал.',
      replace: 'Кот проснулся.',
      lineIndex: 5,
    })

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })
})
