import { describe, it, expect } from 'vitest'
import {
  isSelectionWithinLimit,
  isNoteTextWithinLimit,
  SELECTED_TEXT_MAX_LENGTH,
  NOTE_TEXT_MAX_LENGTH,
} from './annotation-limits'

describe('isSelectionWithinLimit', () => {
  it('accepts a selection at exactly SELECTED_TEXT_MAX_LENGTH', () => {
    expect(isSelectionWithinLimit('a'.repeat(SELECTED_TEXT_MAX_LENGTH))).toBe(true)
  })

  it('rejects a selection one over SELECTED_TEXT_MAX_LENGTH', () => {
    expect(isSelectionWithinLimit('a'.repeat(SELECTED_TEXT_MAX_LENGTH + 1))).toBe(false)
  })
})

describe('isNoteTextWithinLimit', () => {
  it('accepts a note at exactly NOTE_TEXT_MAX_LENGTH', () => {
    expect(isNoteTextWithinLimit('a'.repeat(NOTE_TEXT_MAX_LENGTH))).toBe(true)
  })

  it('rejects a note one over NOTE_TEXT_MAX_LENGTH', () => {
    expect(isNoteTextWithinLimit('a'.repeat(NOTE_TEXT_MAX_LENGTH + 1))).toBe(false)
  })
})
