import { describe, it, expect } from 'vitest'
import { resolveTargetInText } from './resolve-target-in-text'

describe('resolveTargetInText', () => {
  it('returns the exact target when it is a verbatim substring', () => {
    const currentText = 'Дракон тихо вздохнул и полетел домой.'

    expect(resolveTargetInText(currentText, 'тихо вздохнул')).toEqual({
      ok: true,
      resolvedTarget: 'тихо вздохнул',
    })
  })

  it('recovers the true substring when whitespace differs (joined lines, extra spaces)', () => {
    const currentText = 'Дракон тихо\nвздохнул   и полетел домой.'

    expect(resolveTargetInText(currentText, 'тихо вздохнул и полетел')).toEqual({
      ok: true,
      resolvedTarget: 'тихо\nвздохнул   и полетел',
    })
  })

  it('returns not ok when the target does not appear in the text at all', () => {
    const currentText = 'Дракон тихо вздохнул и полетел домой.'

    expect(resolveTargetInText(currentText, 'единорог станцевал вальс')).toEqual({ ok: false })
  })

  it('returns not ok for an empty or whitespace-only target', () => {
    const currentText = 'Дракон тихо вздохнул.'

    expect(resolveTargetInText(currentText, '   ')).toEqual({ ok: false })
  })

  it('trims a target with surrounding whitespace before matching', () => {
    const currentText = 'Дракон тихо вздохнул.'

    expect(resolveTargetInText(currentText, '  тихо вздохнул  ')).toEqual({
      ok: true,
      resolvedTarget: 'тихо вздохнул',
    })
  })
})
