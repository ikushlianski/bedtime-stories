import { describe, it, expect } from 'vitest'
import { formatParentFeedback } from './format-parent-feedback'

describe('formatParentFeedback', () => {
  it('returns an empty array when review is null and no annotations', () => {
    const result = formatParentFeedback({ review: null, annotations: [] })

    expect(result).toEqual([])
  })

  it('returns an empty array when every review field is null and notes blank', () => {
    const result = formatParentFeedback({
      review: { rating: null, pacingOk: null, wouldReuse: null, notes: '   ' },
      annotations: [],
    })

    expect(result).toEqual([])
  })

  it('emits a pacing line when pacingOk is false', () => {
    const result = formatParentFeedback({
      review: { rating: null, pacingOk: false, wouldReuse: null, notes: null },
      annotations: [],
    })

    expect(result.some((line) => line.includes('темп истории был неудачным'))).toBe(true)
  })

  it('marks a story the parent would not reuse', () => {
    const result = formatParentFeedback({
      review: { rating: null, pacingOk: null, wouldReuse: false, notes: null },
      annotations: [],
    })

    expect(result.some((line) => line.includes('НЕ переиспользовал'))).toBe(true)
  })

  it('includes free-text review notes verbatim', () => {
    const result = formatParentFeedback({
      review: { rating: null, pacingOk: null, wouldReuse: null, notes: 'слишком длинно' },
      annotations: [],
    })

    expect(result.some((line) => line.includes('слишком длинно'))).toBe(true)
  })

  it('formats a disliked annotation with its quote and note', () => {
    const result = formatParentFeedback({
      review: null,
      annotations: [
        {
          type: 'sasha_disliked',
          selectedText: 'дракон зарычал',
          noteText: 'тут слишком страшно',
        },
      ],
    })

    const line = result.find((l) => l.includes('дракон зарычал'))

    expect(line).toBeDefined()
    expect(line).toContain('тут слишком страшно')
  })

  it('skips a my_note annotation that has no note text', () => {
    const result = formatParentFeedback({
      review: null,
      annotations: [
        { type: 'my_note', selectedText: 'какой-то фрагмент', noteText: null },
      ],
    })

    expect(result).toEqual([])
  })

  it('renders rating on a 1–5 scale', () => {
    const result = formatParentFeedback({
      review: { rating: 4, pacingOk: null, wouldReuse: null, notes: null },
      annotations: [],
    })

    expect(result.some((line) => line.includes('Оценка родителя: 4 из 5'))).toBe(true)
  })

  it('combines review lines and annotation lines into one list', () => {
    const result = formatParentFeedback({
      review: { rating: 5, pacingOk: true, wouldReuse: true, notes: 'хорошая история' },
      annotations: [
        { type: 'sasha_loved', selectedText: 'финал', noteText: null },
        { type: 'my_note', selectedText: 'начало', noteText: 'можно короче' },
      ],
    })

    expect(result).toHaveLength(6)
    expect(result.some((line) => line.includes('Оценка родителя: 5 из 5'))).toBe(true)
    expect(result.some((line) => line.includes('Ребёнку очень понравилось: «финал»'))).toBe(true)
    expect(result.some((line) => line.includes('Заметка родителя к фрагменту «начало»: можно короче'))).toBe(true)
  })
})
