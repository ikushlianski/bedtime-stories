import { describe, it, expect, vi } from 'vitest'

vi.mock('@bedtime/core/db/client', () => {
  const limit = vi.fn(async () => [{ agentOverrides: { writer: { model: 'universe/u-writer' } } }])
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  return { db: { select } }
})

import { resolvePipelineModels } from './pipeline-defaults'

describe('resolvePipelineModels', () => {
  it('per-story override beats universe default; other stages keep universe defaults', async () => {
    const models = await resolvePipelineModels(42, {
      writer: { model: 'story/s-writer' },
    })

    expect(models.writer).toBe('story/s-writer')
    expect(models.plotter).toBe('anthropic/claude-sonnet-4')
    expect(models.plotCritic).toBe('anthropic/claude-sonnet-4')
    expect(models.writerCritic).toBe('anthropic/claude-sonnet-4')
  })

  it('universe override applies when no per-story override is given', async () => {
    const models = await resolvePipelineModels(42, null)

    expect(models.writer).toBe('universe/u-writer')
    expect(models.plotter).toBe('anthropic/claude-sonnet-4')
  })

  it('falls through to defaults for null universe and null per-story', async () => {
    const models = await resolvePipelineModels(null, null)

    expect(models.writer).toBe('anthropic/claude-sonnet-4')
    expect(models.plotter).toBe('anthropic/claude-sonnet-4')
  })
})
