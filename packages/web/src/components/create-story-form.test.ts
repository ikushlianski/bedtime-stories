import { describe, it, expect } from 'vitest'
import {
  validateCreateStoryForm,
  INITIAL_CREATE_STORY_FORM,
  type CreateStoryFormState,
} from './create-story-form'

const MOCK_MODELS = {
  plotter: { model: 'gpt-4' },
  writer: { model: 'claude-3' },
  plotterQuestions: { model: 'gpt-4-turbo' },
}

function formWith(overrides: Partial<CreateStoryFormState>): CreateStoryFormState {
  return { ...INITIAL_CREATE_STORY_FORM, ...overrides }
}

describe('validateCreateStoryForm', () => {
  it('accepts a valid seed with a universe and models, and returns the input', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'A hero learns patience', groupId: 1, perStageOverrides: MOCK_MODELS }))

    expect(result).toEqual({ valid: true, input: { seed: 'A hero learns patience', pipelineMode: 'manual', groupId: 1, perStageOverrides: MOCK_MODELS } })
  })

  it('trims the seed before returning', () => {
    const result = validateCreateStoryForm(formWith({ seed: '   brave bear   ', groupId: 1, perStageOverrides: MOCK_MODELS }))

    expect(result).toEqual({ valid: true, input: { seed: 'brave bear', pipelineMode: 'manual', groupId: 1, perStageOverrides: MOCK_MODELS } })
  })

  it('includes pipelineMode=manual when set', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'test', groupId: 1, pipelineMode: 'manual', perStageOverrides: MOCK_MODELS }))

    expect(result).toEqual({ valid: true, input: { seed: 'test', pipelineMode: 'manual', groupId: 1, perStageOverrides: MOCK_MODELS } })
  })

  it('accepts when no models are specified (backend uses DeepSeek defaults)', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'test', groupId: 1 }))

    expect(result.valid).toBe(true)
  })

  it('rejects an empty seed', () => {
    const result = validateCreateStoryForm(formWith({ seed: '   ', groupId: 1, perStageOverrides: MOCK_MODELS }))

    expect(result.valid).toBe(false)
  })

  it('rejects a seed longer than 5000 characters', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'A'.repeat(5001), groupId: 1, perStageOverrides: MOCK_MODELS }))

    expect(result.valid).toBe(false)
  })

  it('rejects when no universe is selected', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'valid seed', groupId: null, perStageOverrides: MOCK_MODELS }))

    expect(result.valid).toBe(false)
  })
})
