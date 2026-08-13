import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const updateFavoriteSchema = z.object({
  favorite: z.boolean(),
})

describe('updateFavoriteSchema', () => {
  it('accepts favorite set to true', () => {
    const result = updateFavoriteSchema.safeParse({ favorite: true })
    expect(result.success).toBe(true)
  })

  it('accepts favorite set to false', () => {
    const result = updateFavoriteSchema.safeParse({ favorite: false })
    expect(result.success).toBe(true)
  })

  it('rejects missing favorite field', () => {
    const result = updateFavoriteSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects a non-boolean favorite value', () => {
    const result = updateFavoriteSchema.safeParse({ favorite: 'true' })
    expect(result.success).toBe(false)
  })
})
