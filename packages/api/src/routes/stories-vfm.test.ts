import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const vfmSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().optional(),
})

describe('vfmSchema', () => {
  it('rejects rating below 1', () => {
    expect(vfmSchema.safeParse({ rating: 0 }).success).toBe(false)
  })

  it('rejects rating above 5', () => {
    expect(vfmSchema.safeParse({ rating: 6 }).success).toBe(false)
  })

  it('rejects non-integer rating', () => {
    expect(vfmSchema.safeParse({ rating: 3.5 }).success).toBe(false)
  })

  it('accepts rating without note', () => {
    expect(vfmSchema.safeParse({ rating: 4 }).success).toBe(true)
  })

  it('accepts rating with note', () => {
    expect(vfmSchema.safeParse({ rating: 5, note: 'worth it' }).success).toBe(true)
  })
})
