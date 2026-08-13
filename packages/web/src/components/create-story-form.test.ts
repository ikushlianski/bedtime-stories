import { describe, it, expect } from 'vitest'
import {
  validateCreateStoryForm,
  buildAccumulatedSeed,
  INITIAL_CREATE_STORY_FORM,
  MAX_UNIVERSES_PER_STORY,
  type CreateStoryFormState,
} from './create-story-form'

function formWith(overrides: Partial<CreateStoryFormState>): CreateStoryFormState {
  return { ...INITIAL_CREATE_STORY_FORM, ...overrides }
}

describe('validateCreateStoryForm', () => {
  it('accepts a valid seed with a single universe and always uses auto mode', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'A hero learns patience', groupIds: [1] }))

    expect(result).toEqual({ valid: true, input: { seed: 'A hero learns patience', pipelineMode: 'auto', groupIds: [1] } })
  })

  it('accepts a valid seed with multiple universes mixed together', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'A hero learns patience', groupIds: [1, 2, 3] }))

    expect(result).toEqual({ valid: true, input: { seed: 'A hero learns patience', pipelineMode: 'auto', groupIds: [1, 2, 3] } })
  })

  it('accepts a valid seed with no universe selected', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'A hero learns patience', groupIds: [] }))

    expect(result).toEqual({ valid: true, input: { seed: 'A hero learns patience', pipelineMode: 'auto' } })
  })

  it('trims the seed before returning', () => {
    const result = validateCreateStoryForm(formWith({ seed: '   brave bear   ', groupIds: [1] }))

    expect(result).toEqual({ valid: true, input: { seed: 'brave bear', pipelineMode: 'auto', groupIds: [1] } })
  })

  it('rejects an empty seed', () => {
    const result = validateCreateStoryForm(formWith({ seed: '   ', groupIds: [1] }))

    expect(result.valid).toBe(false)
  })

  it('rejects a seed longer than 5000 characters', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'A'.repeat(5001), groupIds: [1] }))

    expect(result.valid).toBe(false)
  })

  it('rejects more universes than the mixing limit', () => {
    const tooMany = Array.from({ length: MAX_UNIVERSES_PER_STORY + 1 }, (_, i) => i + 1)
    const result = validateCreateStoryForm(formWith({ seed: 'valid seed', groupIds: tooMany }))

    expect(result.valid).toBe(false)
  })

  it('omits structureKey and lensKey when left on Auto', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'valid seed', groupIds: [1] }))

    if (!result.valid) {
      throw new Error('expected valid result')
    }

    expect(result.input).not.toHaveProperty('structureKey')
    expect(result.input).not.toHaveProperty('lensKey')
  })

  it('forwards an explicit structureKey and lensKey when chosen', () => {
    const result = validateCreateStoryForm(
      formWith({ seed: 'valid seed', groupIds: [1], structureKey: 'snowball', lensKey: 'gosha-errs' }),
    )

    expect(result).toEqual({
      valid: true,
      input: {
        seed: 'valid seed',
        pipelineMode: 'auto',
        groupIds: [1],
        structureKey: 'snowball',
        lensKey: 'gosha-errs',
      },
    })
  })

  it('omits manualTopicIds when none are selected', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'valid seed', groupIds: [1] }))

    if (!result.valid) {
      throw new Error('expected valid result')
    }

    expect(result.input).not.toHaveProperty('manualTopicIds')
  })

  it('forwards manually selected topic ids', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'valid seed', groupIds: [1], manualTopicIds: [3, 7] }))

    expect(result).toEqual({
      valid: true,
      input: {
        seed: 'valid seed',
        pipelineMode: 'auto',
        groupIds: [1],
        manualTopicIds: [3, 7],
      },
    })
  })
})

describe('buildAccumulatedSeed', () => {
  it('joins accumulated messages with a blank line between them', () => {
    expect(buildAccumulatedSeed(['Герой боится темноты', 'Он ночует у бабушки'], '')).toBe(
      'Герой боится темноты\n\nОн ночует у бабушки',
    )
  })

  it('appends a non-empty draft after the accumulated messages', () => {
    expect(buildAccumulatedSeed(['Герой боится темноты'], 'И находит фонарик')).toBe(
      'Герой боится темноты\n\nИ находит фонарик',
    )
  })

  it('falls back to the draft alone when nothing was added yet', () => {
    expect(buildAccumulatedSeed([], 'Единственная идея')).toBe('Единственная идея')
  })

  it('filters out empty and whitespace-only messages', () => {
    expect(buildAccumulatedSeed(['Идея один', '   ', ''], '')).toBe('Идея один')
  })

  it('trims each message and the draft', () => {
    expect(buildAccumulatedSeed(['  Идея один  '], '  черновик  ')).toBe('Идея один\n\nчерновик')
  })

  it('returns an empty string when there is nothing at all', () => {
    expect(buildAccumulatedSeed([], '   ')).toBe('')
  })
})
