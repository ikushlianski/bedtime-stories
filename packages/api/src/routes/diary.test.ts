import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const createDiarySchema = z.object({
  content: z.string().min(1).max(2000, 'Слишком длинная запись (максимум 2000 символов)'),
})

describe('createDiarySchema', () => {
  it('rejects empty content', () => {
    const result = createDiarySchema.safeParse({ content: '' })

    expect(result.success).toBe(false)
  })

  it('rejects content over 2000 characters', () => {
    const result = createDiarySchema.safeParse({ content: 'a'.repeat(2001) })

    expect(result.success).toBe(false)
  })

  it('accepts content at exactly 2000 characters', () => {
    const result = createDiarySchema.safeParse({ content: 'a'.repeat(2000) })

    expect(result.success).toBe(true)
  })

  it('accepts normal content', () => {
    const result = createDiarySchema.safeParse({ content: 'Сегодня Саша заинтересовался динозаврами' })

    expect(result.success).toBe(true)
  })

  it('carries the custom Russian message when content is too long', () => {
    const result = createDiarySchema.safeParse({ content: 'a'.repeat(2001) })

    if (result.success) {
      throw new Error('expected validation to fail')
    }

    expect(result.error.issues[0]?.message).toBe('Слишком длинная запись (максимум 2000 символов)')
  })
})
