import { describe, it, expect } from 'vitest'
import {
  validateCreateStoryForm,
  buildAccumulatedSeed,
  INITIAL_CREATE_STORY_FORM,
  type CreateStoryFormState,
} from './create-story-form'

function formWith(overrides: Partial<CreateStoryFormState>): CreateStoryFormState {
  return { ...INITIAL_CREATE_STORY_FORM, ...overrides }
}

describe('validateCreateStoryForm', () => {
  it('accepts a valid seed with a universe and always uses auto mode', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'A hero learns patience', groupId: 1 }))

    expect(result).toEqual({ valid: true, input: { seed: 'A hero learns patience', pipelineMode: 'auto', groupId: 1 } })
  })

  it('trims the seed before returning', () => {
    const result = validateCreateStoryForm(formWith({ seed: '   brave bear   ', groupId: 1 }))

    expect(result).toEqual({ valid: true, input: { seed: 'brave bear', pipelineMode: 'auto', groupId: 1 } })
  })

  it('rejects an empty seed', () => {
    const result = validateCreateStoryForm(formWith({ seed: '   ', groupId: 1 }))

    expect(result.valid).toBe(false)
  })

  it('rejects a seed longer than 5000 characters', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'A'.repeat(5001), groupId: 1 }))

    expect(result.valid).toBe(false)
  })

  it('rejects when no universe is selected', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'valid seed', groupId: null }))

    expect(result.valid).toBe(false)
  })

  it('omits structureKey and lensKey when left on Auto', () => {
    const result = validateCreateStoryForm(formWith({ seed: 'valid seed', groupId: 1 }))

    if (!result.valid) {
      throw new Error('expected valid result')
    }

    expect(result.input).not.toHaveProperty('structureKey')
    expect(result.input).not.toHaveProperty('lensKey')
  })

  it('forwards an explicit structureKey and lensKey when chosen', () => {
    const result = validateCreateStoryForm(
      formWith({ seed: 'valid seed', groupId: 1, structureKey: 'snowball', lensKey: 'gosha-errs' }),
    )

    expect(result).toEqual({
      valid: true,
      input: {
        seed: 'valid seed',
        pipelineMode: 'auto',
        groupId: 1,
        structureKey: 'snowball',
        lensKey: 'gosha-errs',
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
