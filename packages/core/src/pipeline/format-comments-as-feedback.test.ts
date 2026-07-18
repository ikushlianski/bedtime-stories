import { describe, it, expect } from 'vitest'
import { formatCommentsAsFeedback } from './format-comments-as-feedback'

describe('formatCommentsAsFeedback', () => {
  it('renders a targeted item as a fragment quote with the note', () => {
    const result = formatCommentsAsFeedback([
      { selectedText: 'дракон зарычал', noteText: 'сделай не таким страшным' },
    ])

    expect(result).toBe('К фрагменту «дракон зарычал»: сделай не таким страшным')
  })

  it('renders a whole-story item (no selection) with the general-comment label', () => {
    const result = formatCommentsAsFeedback([
      { selectedText: null, noteText: 'темп кажется слишком быстрым' },
    ])

    expect(result).toBe('Общий комментарий: темп кажется слишком быстрым')
  })

  it('skips items with no note text', () => {
    const result = formatCommentsAsFeedback([
      { selectedText: 'что-то', noteText: null },
      { selectedText: null, noteText: '' },
      { selectedText: 'дракон', noteText: 'ok' },
    ])

    expect(result).toBe('К фрагменту «дракон»: ok')
  })

  it('joins multiple items with a blank line between them', () => {
    const result = formatCommentsAsFeedback([
      { selectedText: 'фрагмент один', noteText: 'заметка один' },
      { selectedText: null, noteText: 'общая заметка' },
    ])

    expect(result).toBe('К фрагменту «фрагмент один»: заметка один\n\nОбщий комментарий: общая заметка')
  })

  it('returns an empty string for an empty list', () => {
    expect(formatCommentsAsFeedback([])).toBe('')
  })

  it('returns an empty string when every item lacks note text', () => {
    const result = formatCommentsAsFeedback([
      { selectedText: 'x', noteText: null },
      { selectedText: null, noteText: undefined as unknown as null },
    ])

    expect(result).toBe('')
  })
})
