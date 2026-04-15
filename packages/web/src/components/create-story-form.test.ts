import { describe, it, expect } from 'vitest'
import {
  validateCreateStoryForm,
  INITIAL_CREATE_STORY_FORM,
  type CreateStoryFormState,
} from './create-story-form'

function formWith(overrides: Partial<CreateStoryFormState>): CreateStoryFormState {
  return { ...INITIAL_CREATE_STORY_FORM, ...overrides }
}

describe('validateCreateStoryForm', () => {
  describe('generate mode', () => {
    it('accepts a non-empty seed and returns a seed input', () => {
      const result = validateCreateStoryForm(formWith({ seed: 'A hero learns patience' }))

      expect(result).toEqual({ valid: true, input: { seed: 'A hero learns patience' } })
    })

    it('trims the seed before returning', () => {
      const result = validateCreateStoryForm(formWith({ seed: '   brave bear   ' }))

      expect(result).toEqual({ valid: true, input: { seed: 'brave bear' } })
    })

    it('rejects an empty seed', () => {
      const result = validateCreateStoryForm(formWith({ seed: '   ' }))

      expect(result.valid).toBe(false)
    })

    it('rejects a seed longer than 5000 characters', () => {
      const result = validateCreateStoryForm(formWith({ seed: 'A'.repeat(5001) }))

      expect(result.valid).toBe(false)
    })
  })

  describe('paste mode', () => {
    it('accepts a textFinal with no title', () => {
      const result = validateCreateStoryForm(
        formWith({ mode: 'paste', textFinal: 'Once upon a time...' }),
      )

      expect(result).toEqual({ valid: true, input: { textFinal: 'Once upon a time...' } })
    })

    it('accepts a textFinal with a title and includes the title in the input', () => {
      const result = validateCreateStoryForm(
        formWith({ mode: 'paste', title: 'Brave Bear', textFinal: 'Once upon a time...' }),
      )

      expect(result).toEqual({
        valid: true,
        input: { title: 'Brave Bear', textFinal: 'Once upon a time...' },
      })
    })

    it('trims title and textFinal', () => {
      const result = validateCreateStoryForm(
        formWith({ mode: 'paste', title: '  Bear  ', textFinal: '  Once upon a time...  ' }),
      )

      expect(result).toEqual({
        valid: true,
        input: { title: 'Bear', textFinal: 'Once upon a time...' },
      })
    })

    it('rejects empty textFinal', () => {
      const result = validateCreateStoryForm(formWith({ mode: 'paste', textFinal: '  ' }))

      expect(result.valid).toBe(false)
    })

    it('rejects a title longer than 200 characters', () => {
      const result = validateCreateStoryForm(
        formWith({ mode: 'paste', title: 'T'.repeat(201), textFinal: 'Once upon a time' }),
      )

      expect(result.valid).toBe(false)
    })
  })
})
