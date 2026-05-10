import type { CreateStoryInput, PerStageOverrides } from '../lib/api'

export interface CreateStoryFormState {
  seed: string
  groupId: number | null
  pipelineMode: 'auto' | 'manual'
  perStageOverrides?: PerStageOverrides
}

export const INITIAL_CREATE_STORY_FORM: CreateStoryFormState = {
  seed: '',
  groupId: null,
  pipelineMode: 'manual',
}

export type CreateStoryFormValidation =
  | { valid: true; input: CreateStoryInput }
  | { valid: false; reason: string }

export function validateCreateStoryForm(state: CreateStoryFormState): CreateStoryFormValidation {
  const seed = state.seed.trim()

  if (!seed) {
    return { valid: false, reason: 'Seed is required' }
  }

  if (seed.length > 5000) {
    return { valid: false, reason: 'Seed is too long' }
  }

  if (state.groupId === null) {
    return { valid: false, reason: 'Universe is required' }
  }

  return {
    valid: true,
    input: {
      seed,
      pipelineMode: state.pipelineMode,
      groupId: state.groupId,
      perStageOverrides: state.perStageOverrides,
    },
  }
}
