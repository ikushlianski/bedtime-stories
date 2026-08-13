import { describe, it, expect } from 'vitest'
import { createAnnotationSchema } from './create-annotation-schema'

describe('createAnnotationSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = createAnnotationSchema.safeParse({ type: 'my_note', selected_text: 'a passage', note_text: 'a note' })

    expect(result.success).toBe(true)
  })

  it('accepts selected_text at exactly 2000 characters', () => {
    const result = createAnnotationSchema.safeParse({ type: 'my_note', selected_text: 'a'.repeat(2000) })

    expect(result.success).toBe(true)
  })

  it('rejects selected_text over 2000 characters', () => {
    const result = createAnnotationSchema.safeParse({ type: 'my_note', selected_text: 'a'.repeat(2001) })

    expect(result.success).toBe(false)
  })

  it('carries the custom Russian message when selected_text is too long', () => {
    const result = createAnnotationSchema.safeParse({ type: 'my_note', selected_text: 'a'.repeat(2001) })

    if (result.success) {
      throw new Error('expected validation to fail')
    }

    expect(result.error.issues[0]?.message).toBe('Слишком большой фрагмент текста (максимум 2000 символов)')
  })

  it('accepts note_text at exactly 2000 characters', () => {
    const result = createAnnotationSchema.safeParse({ type: 'my_note', selected_text: 'passage', note_text: 'a'.repeat(2000) })

    expect(result.success).toBe(true)
  })

  it('rejects note_text over 2000 characters', () => {
    const result = createAnnotationSchema.safeParse({ type: 'my_note', selected_text: 'passage', note_text: 'a'.repeat(2001) })

    expect(result.success).toBe(false)
  })

  it('carries the custom Russian message when note_text is too long', () => {
    const result = createAnnotationSchema.safeParse({ type: 'my_note', selected_text: 'passage', note_text: 'a'.repeat(2001) })

    if (result.success) {
      throw new Error('expected validation to fail')
    }

    expect(result.error.issues[0]?.message).toBe('Слишком длинная заметка (максимум 2000 символов)')
  })

  it('still accepts a reaction annotation with no note_text at all', () => {
    const result = createAnnotationSchema.safeParse({ type: 'sasha_laughed', selected_text: 'a fragment the child laughed at' })

    expect(result.success).toBe(true)
  })
})
