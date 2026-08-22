import { describe, it, expect } from 'vitest'
import { extractFragmentMarkers, buildFragmentsBlock, MAX_FRAGMENTS_PER_STORY } from './fragments-prompt'

describe('extractFragmentMarkers', () => {
  it('extracts a single chosen fragment id and strips the marker line', () => {
    const plan = 'ЭМОЦИОНАЛЬНАЯ ЗАДАЧА\nтекст плана\n\nФРАГМЕНТЫ: 12'
    const result = extractFragmentMarkers(plan)

    expect(result.fragmentIds).toEqual([12])
    expect(result.cleanedText).toBe('ЭМОЦИОНАЛЬНАЯ ЗАДАЧА\nтекст плана')
    expect(result.cleanedText).not.toContain('ФРАГМЕНТ')
  })

  it('extracts several comma-separated ids', () => {
    const plan = 'план\nФРАГМЕНТЫ: 3, 7, 12'
    const result = extractFragmentMarkers(plan)

    expect(result.fragmentIds).toEqual([3, 7, 12])
    expect(result.cleanedText).toBe('план')
  })

  it('accepts the # the model echoes and mixed separators', () => {
    const plan = 'план\nФРАГМЕНТЫ: #3 и #7'
    const result = extractFragmentMarkers(plan)

    expect(result.fragmentIds).toEqual([3, 7])
    expect(result.cleanedText).toBe('план')
  })

  it('returns empty when the plan declines all fragments', () => {
    const plan = 'план истории\nФРАГМЕНТЫ: нет'
    const result = extractFragmentMarkers(plan)

    expect(result.fragmentIds).toEqual([])
    expect(result.cleanedText).toBe('план истории')
  })

  it('still accepts the singular ФРАГМЕНТ heading', () => {
    const plan = 'план\nФРАГМЕНТ: 5'
    const result = extractFragmentMarkers(plan)

    expect(result.fragmentIds).toEqual([5])
  })

  it('dedupes repeated ids', () => {
    const plan = 'план\nФРАГМЕНТЫ: 5, 5, 9'
    const result = extractFragmentMarkers(plan)

    expect(result.fragmentIds).toEqual([5, 9])
  })

  it('treats a missing marker as no fragments and leaves the text intact', () => {
    const plan = 'обычный план без маркера'
    const result = extractFragmentMarkers(plan)

    expect(result.fragmentIds).toEqual([])
    expect(result.cleanedText).toBe(plan)
  })
})

describe('buildFragmentsBlock', () => {
  it('is empty when there are no eligible fragments', () => {
    expect(buildFragmentsBlock([])).toBe('')
  })

  it('marks previously-used fragments and states the per-story cap', () => {
    const block = buildFragmentsBlock([
      { id: 1, text: 'свежий фрагмент', rank: 0, usedCount: 0, exactQuote: false },
      { id: 2, text: 'старый фрагмент', rank: 0, usedCount: 3, exactQuote: false },
    ])

    expect(block).toContain('[Фрагмент #1] свежий фрагмент')
    expect(block).toContain('[Фрагмент #2 (уже использован ранее)] старый фрагмент')
    expect(block).toContain(`от нуля до ${MAX_FRAGMENTS_PER_STORY}`)
    expect(block).toContain('ФРАГМЕНТЫ: <id выбранных фрагментов через запятую или слово нет>')
  })

  it('marks fragments flagged as exact quotes and adds the verbatim rule', () => {
    const block = buildFragmentsBlock([
      { id: 1, text: 'Пришел, наскандалил и ушел', rank: 0, usedCount: 0, exactQuote: true },
    ])

    expect(block).toContain('[Фрагмент #1 (ДОСЛОВНАЯ ЦИТАТА)] Пришел, наскандалил и ушел')
    expect(block).toContain('СЛОВО В СЛОВО')
  })
})
