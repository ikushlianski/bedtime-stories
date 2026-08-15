import { describe, it, expect } from 'vitest'
import { z } from 'zod'

const ORCHESTRATOR_STAGES = ['plotter', 'writer'] as const
const REASON_CHIPS = ['too_verbose', 'too_short', 'broke_format', 'boring_prose', 'off_topic', 'repetitive', 'not_calm', 'weak_ending', 'too_slow', 'failed', 'other'] as const

const swapModelSchema = z.object({
  stage: z.enum(ORCHESTRATOR_STAGES),
  toModel: z.string().min(1).optional(),
  reasonChip: z.enum(REASON_CHIPS).optional(),
  reasonText: z.string().optional(),
})

describe('swapModelSchema', () => {
  it('accepts payload missing both reason_chip and reason_text (plain redo, no reason given)', () => {
    const result = swapModelSchema.safeParse({ stage: 'plotter', toModel: 'm/x' })
    expect(result.success).toBe(true)
  })

  it('accepts payload missing toModel and reason entirely (plain redo, keep current model)', () => {
    const result = swapModelSchema.safeParse({ stage: 'writer' })
    expect(result.success).toBe(true)
  })

  it('rejects empty-string toModel', () => {
    const result = swapModelSchema.safeParse({ stage: 'plotter', toModel: '' })
    expect(result.success).toBe(false)
  })

  it('accepts payload with only reason_chip', () => {
    const result = swapModelSchema.safeParse({ stage: 'plotter', toModel: 'm/x', reasonChip: 'boring_prose' })
    expect(result.success).toBe(true)
  })

  it('accepts payload with only reason_text', () => {
    const result = swapModelSchema.safeParse({ stage: 'writer', toModel: 'm/x', reasonText: 'too repetitive' })
    expect(result.success).toBe(true)
  })

  it('rejects unknown stage', () => {
    const result = swapModelSchema.safeParse({ stage: 'improver', toModel: 'm/x', reasonChip: 'other' })
    expect(result.success).toBe(false)
  })

  it('rejects critic stages (Phase 4 scope, no single-stage rerun yet)', () => {
    expect(swapModelSchema.safeParse({ stage: 'plotCritic', toModel: 'm/x', reasonChip: 'other' }).success).toBe(false)
    expect(swapModelSchema.safeParse({ stage: 'writerCritic', toModel: 'm/x', reasonChip: 'other' }).success).toBe(false)
  })

  it('rejects unknown reason_chip', () => {
    const result = swapModelSchema.safeParse({ stage: 'plotter', toModel: 'm/x', reasonChip: 'made_up' })
    expect(result.success).toBe(false)
  })
})
