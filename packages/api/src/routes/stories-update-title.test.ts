import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const updateTitleSchema = z.object({
  title: z.string().trim().min(1),
})

describe('updateTitleSchema', () => {
  it('accepts a valid title', () => {
    const result = updateTitleSchema.safeParse({ title: 'The Best Story' })
    expect(result.success).toBe(true)
  })

  it('rejects empty string', () => {
    const result = updateTitleSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only string', () => {
    const result = updateTitleSchema.safeParse({ title: '   ' })
    expect(result.success).toBe(false)
  })

  it('trims whitespace from title', () => {
    const result = updateTitleSchema.safeParse({ title: '  Trimmed Title  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Trimmed Title')
    }
  })

  it('accepts single character title', () => {
    const result = updateTitleSchema.safeParse({ title: 'A' })
    expect(result.success).toBe(true)
  })

  it('rejects missing title field', () => {
    const result = updateTitleSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
