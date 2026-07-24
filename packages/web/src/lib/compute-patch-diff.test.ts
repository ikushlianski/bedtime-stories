import { describe, it, expect } from 'vitest'
import { computePatchDiff } from './compute-patch-diff'

describe('computePatchDiff', () => {
  it('returns a single unchanged segment when nothing changed', () => {
    expect(computePatchDiff('Гоша идёт домой', 'Гоша идёт домой')).toEqual([
      { type: 'unchanged', text: 'Гоша идёт домой' },
    ])
  })

  it('marks an inserted word as added', () => {
    const segments = computePatchDiff('Гоша идёт домой', 'Гоша быстро идёт домой')

    expect(segments).toEqual([
      { type: 'unchanged', text: 'Гоша ' },
      { type: 'added', text: 'быстро ' },
      { type: 'unchanged', text: 'идёт домой' },
    ])
  })

  it('marks a removed word as removed', () => {
    const segments = computePatchDiff('Гоша быстро идёт домой', 'Гоша идёт домой')

    expect(segments).toEqual([
      { type: 'unchanged', text: 'Гоша ' },
      { type: 'removed', text: 'быстро ' },
      { type: 'unchanged', text: 'идёт домой' },
    ])
  })

  it('represents a word replacement as a removed segment followed by an added one', () => {
    const segments = computePatchDiff('Гоша боится темноты', 'Гоша боится грозы')

    expect(segments).toEqual([
      { type: 'unchanged', text: 'Гоша боится ' },
      { type: 'removed', text: 'темноты' },
      { type: 'added', text: 'грозы' },
    ])
  })

  it('handles a fully rewritten passage as one removed and one added segment', () => {
    const segments = computePatchDiff('Старый текст', 'Совсем другой текст')

    expect(segments.some((s) => s.type === 'removed')).toBe(true)
    expect(segments.some((s) => s.type === 'added')).toBe(true)
  })

  it('handles empty original text as pure addition', () => {
    expect(computePatchDiff('', 'Новый текст')).toEqual([{ type: 'added', text: 'Новый текст' }])
  })
})
