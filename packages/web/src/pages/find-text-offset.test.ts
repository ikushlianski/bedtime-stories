import { describe, it, expect } from 'vitest'
import { findTextOffset, findTextOffsetNear } from './find-text-offset'

describe('findTextOffset', () => {
  it('returns global start and end when the selection appears once in the full story', () => {
    const fullText = 'Once upon a time the brave dragon yawned.'
    const offset = findTextOffset(fullText, 'the brave dragon')

    expect(offset).not.toBeNull()
    if (offset !== null) {
      expect(fullText.slice(offset.start, offset.end)).toBe('the brave dragon')
    }
  })

  it('returns the first occurrence when the selection appears multiple times', () => {
    const fullText = 'cat and cat and cat'
    const offset = findTextOffset(fullText, 'cat')

    expect(offset).toEqual({ start: 0, end: 3 })
  })

  it('returns null when the selected text is not present at all', () => {
    expect(findTextOffset('hello world', 'missing')).toBeNull()
  })

  it('returns null for empty selection to avoid a meaningless offset', () => {
    expect(findTextOffset('hello world', '')).toBeNull()
  })

  it('handles multiline selections that span paragraph breaks', () => {
    const fullText = 'First paragraph.\nSecond paragraph.\nThird paragraph.'
    const offset = findTextOffset(fullText, 'paragraph.\nSecond paragraph.')

    expect(offset).not.toBeNull()
    if (offset !== null) {
      expect(fullText.slice(offset.start, offset.end)).toBe('paragraph.\nSecond paragraph.')
    }
  })
})

describe('findTextOffsetNear', () => {
  it('picks the occurrence closest to the given hint position', () => {
    const fullText = 'cat and cat and cat'
    const offset = findTextOffsetNear(fullText, 'cat', 15)

    expect(offset).toEqual({ start: 16, end: 19 })
  })

  it('falls back to the only occurrence when the hint is irrelevant', () => {
    const fullText = 'hello world'
    const offset = findTextOffsetNear(fullText, 'world', 0)

    expect(offset).toEqual({ start: 6, end: 11 })
  })

  it('returns null when the selection is missing', () => {
    expect(findTextOffsetNear('hello', 'missing', 0)).toBeNull()
  })

  it('returns null for empty selection', () => {
    expect(findTextOffsetNear('hello', '', 0)).toBeNull()
  })
})
