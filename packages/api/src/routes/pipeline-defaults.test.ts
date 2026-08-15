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
    const { models } = await resolvePipelineModels(42, {
      writer: { model: 'story/s-writer' },
    })

    expect(models.writer).toBe('story/s-writer')
    expect(models.plotter).toBe('deepseek/deepseek-v4-pro')
    expect(models.plotCritic).toBe('deepseek/deepseek-v4-pro')
    expect(models.writerCritic).toBe('deepseek/deepseek-v4-pro')
  })

  it('universe override applies when no per-story override is given', async () => {
    const { models } = await resolvePipelineModels(42, null)

    expect(models.writer).toBe('universe/u-writer')
    expect(models.plotter).toBe('deepseek/deepseek-v4-pro')
  })

  it('falls through to defaults for null universe and null per-story', async () => {
    const { models } = await resolvePipelineModels(null, null)

    expect(models.writer).toBe('deepseek/deepseek-v4-pro')
    expect(models.plotter).toBe('deepseek/deepseek-v4-pro')
  })

  it('resolves the fallback model alongside the primary model instead of discarding it', async () => {
    const { fallbacks } = await resolvePipelineModels(null, null)

    expect(fallbacks.plotter).toBe('deepseek/deepseek-v4-flash')
    expect(fallbacks.writer).toBe('deepseek/deepseek-v4-flash')
    expect(fallbacks.plotCritic).toBe('deepseek/deepseek-v4-flash')
    expect(fallbacks.writerCritic).toBe('deepseek/deepseek-v4-flash')
    expect(fallbacks.plotterQuestions).toBe('deepseek/deepseek-v4-flash')
  })

  it('a per-story override that only sets model still resolves the default fallback for that stage', async () => {
    const { fallbacks } = await resolvePipelineModels(42, {
      writer: { model: 'story/s-writer' },
    })

    expect(fallbacks.writer).toBe('deepseek/deepseek-v4-flash')
  })
})
