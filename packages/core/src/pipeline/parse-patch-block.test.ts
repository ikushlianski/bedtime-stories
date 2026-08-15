import { describe, it, expect } from 'vitest'
import { parsePatchBlock } from './parse-patch-block'

describe('parsePatchBlock', () => {
  it('extracts a trimmed patch and summary when both blocks are present', () => {
    const raw = [
      'Конечно, вот замена:',
      '<<<PATCH>>>',
      '  Дракон тихо вздохнул.  ',
      '<<<END PATCH>>>',
      '<<<SUMMARY>>>',
      '  Сделали дракона менее пугающим.  ',
      '<<<END SUMMARY>>>',
    ].join('\n')

    expect(parsePatchBlock(raw)).toEqual({
      patch: 'Дракон тихо вздохнул.',
      summary: 'Сделали дракона менее пугающим.',
    })
  })

  it('returns null when the patch block is missing', () => {
    const raw = ['<<<SUMMARY>>>', 'что-то', '<<<END SUMMARY>>>'].join('\n')

    expect(parsePatchBlock(raw)).toBeNull()
  })

  it('returns null when the summary block is missing', () => {
    const raw = ['<<<PATCH>>>', 'что-то', '<<<END PATCH>>>'].join('\n')

    expect(parsePatchBlock(raw)).toBeNull()
  })

  it('returns null for plain conversational text with no markers', () => {
    expect(parsePatchBlock('Просто обсуждаем план, пока без конкретной замены.')).toBeNull()
  })

  it('captures multi-line patch content', () => {
    const raw = ['<<<PATCH>>>', 'Строка один.', 'Строка два.', '<<<END PATCH>>>', '<<<SUMMARY>>>', 'Итог.', '<<<END SUMMARY>>>'].join('\n')

    expect(parsePatchBlock(raw)).toEqual({
      patch: 'Строка один.\nСтрока два.',
      summary: 'Итог.',
    })
  })

  it('extracts a trimmed target when a TARGET block precedes PATCH and SUMMARY', () => {
    const raw = [
      'Нашёл подходящий фрагмент.',
      '<<<TARGET>>>',
      '  Дракон был очень страшным.  ',
      '<<<END TARGET>>>',
      '<<<PATCH>>>',
      'Дракон был немного застенчивым.',
      '<<<END PATCH>>>',
      '<<<SUMMARY>>>',
      'Сделали дракона добрее.',
      '<<<END SUMMARY>>>',
    ].join('\n')

    expect(parsePatchBlock(raw)).toEqual({
      target: 'Дракон был очень страшным.',
      patch: 'Дракон был немного застенчивым.',
      summary: 'Сделали дракона добрее.',
    })
  })

  it('omits target from the result when no TARGET block is present', () => {
    const raw = ['<<<PATCH>>>', 'Замена.', '<<<END PATCH>>>', '<<<SUMMARY>>>', 'Итог.', '<<<END SUMMARY>>>'].join('\n')

    const result = parsePatchBlock(raw)

    expect(result).toEqual({ patch: 'Замена.', summary: 'Итог.' })
    expect(result?.target).toBeUndefined()
  })

  it('returns null when TARGET is present but PATCH/SUMMARY are missing', () => {
    const raw = ['<<<TARGET>>>', 'Что-то', '<<<END TARGET>>>'].join('\n')

    expect(parsePatchBlock(raw)).toBeNull()
  })
})
