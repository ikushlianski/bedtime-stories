import { describe, it, expect } from 'vitest'
import { derivePerStageModels, PIPELINE_STAGES, type PerStageModels } from './per-stage-models'

const defaults: PerStageModels = PIPELINE_STAGES.reduce((acc, stage) => {
  acc[stage] = { model: `default/${stage}`, fallback: `default-fallback/${stage}` }
  return acc
}, {} as PerStageModels)

describe('derivePerStageModels', () => {
  it('returns default model+fallback for every stage when no overrides exist', () => {
    const result = derivePerStageModels({
      universeAgentOverrides: null,
      perStoryOverrides: null,
      defaultFallbackMap: defaults,
    })

    expect(Object.keys(result).sort()).toEqual([...PIPELINE_STAGES].sort())

    for (const stage of PIPELINE_STAGES) {
      expect(result[stage]).toEqual({ model: `default/${stage}`, fallback: `default-fallback/${stage}` })
    }
  })

  it('lets the universe override model and fallback for a stage', () => {
    const result = derivePerStageModels({
      universeAgentOverrides: { writer: { model: 'u/writer', fallback: 'u/writer-fb' } },
      perStoryOverrides: null,
      defaultFallbackMap: defaults,
    })

    expect(result.writer).toEqual({ model: 'u/writer', fallback: 'u/writer-fb' })
    expect(result.plotter).toEqual({ model: 'default/plotter', fallback: 'default-fallback/plotter' })
  })

  it('falls back to universe when per-story sets only model', () => {
    const result = derivePerStageModels({
      universeAgentOverrides: { writer: { model: 'u/writer', fallback: 'u/writer-fb' } },
      perStoryOverrides: { writer: { model: 's/writer' } },
      defaultFallbackMap: defaults,
    })

    expect(result.writer).toEqual({ model: 's/writer', fallback: 'u/writer-fb' })
  })

  it('per-story override wins over universe and defaults', () => {
    const result = derivePerStageModels({
      universeAgentOverrides: { writer: { model: 'u/writer' } },
      perStoryOverrides: { writer: { model: 's/writer', fallback: 's/writer-fb' } },
      defaultFallbackMap: defaults,
    })

    expect(result.writer).toEqual({ model: 's/writer', fallback: 's/writer-fb' })
  })

  it('emits all 15 pipeline stages', () => {
    expect(PIPELINE_STAGES).toHaveLength(15)
  })
})
