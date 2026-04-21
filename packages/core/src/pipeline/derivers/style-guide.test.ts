import { describe, it, expect } from 'vitest'
import { compileStyleGuide } from './style-guide'

describe('compileStyleGuide', () => {
  it('combines all four non-empty sections', () => {
    const result = compileStyleGuide({
      works: '- пример',
      doesntWork: '- избегать',
      techniques: '- приём',
      minimize: '- сократить',
    })

    expect(result).toContain('## Что работает')
    expect(result).toContain('## Что не работает')
    expect(result).toContain('## Предпочтительные техники')
    expect(result).toContain('## Минимизировать')
  })

  it('omits empty sections', () => {
    const result = compileStyleGuide({
      works: '- пример',
      doesntWork: '',
      techniques: '',
      minimize: '',
    })

    expect(result).toContain('## Что работает')
    expect(result).not.toContain('## Что не работает')
    expect(result).not.toContain('## Предпочтительные техники')
    expect(result).not.toContain('## Минимизировать')
  })

  it('returns empty string when all sections are empty', () => {
    const result = compileStyleGuide({ works: '', doesntWork: '', techniques: '', minimize: '' })

    expect(result).toBe('')
  })

  it('preserves section content verbatim', () => {
    const result = compileStyleGuide({
      works: '- длинные предложения\n- диалог',
      doesntWork: '',
      techniques: '',
      minimize: '',
    })

    expect(result).toContain('- длинные предложения\n- диалог')
  })
})
