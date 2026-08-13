import type { CreateStoryInput } from '../lib/api'

export const MAX_UNIVERSES_PER_STORY = 4

export interface CreateStoryFormState {
  seed: string
  groupIds: number[]
  structureKey: string | null
  lensKey: string | null
  manualTopicIds: number[]
}

export const INITIAL_CREATE_STORY_FORM: CreateStoryFormState = {
  seed: '',
  groupIds: [],
  structureKey: null,
  lensKey: null,
  manualTopicIds: [],
}

export type CreateStoryFormValidation =
  | { valid: true; input: CreateStoryInput }
  | { valid: false; reason: string }

export function buildAccumulatedSeed(messages: string[], draft: string): string {
  const parts = [...messages, draft].map((part) => part.trim()).filter((part) => part.length > 0)

  return parts.join('\n\n')
}

export function validateCreateStoryForm(state: CreateStoryFormState): CreateStoryFormValidation {
  const seed = state.seed.trim()

  if (!seed) {
    return { valid: false, reason: 'Seed is required' }
  }

  if (seed.length > 5000) {
    return { valid: false, reason: 'Seed is too long' }
  }

  if (state.groupIds.length > MAX_UNIVERSES_PER_STORY) {
    return { valid: false, reason: `Choose at most ${MAX_UNIVERSES_PER_STORY} universes` }
  }

  return {
    valid: true,
    input: {
      seed,
      pipelineMode: 'auto',
      ...(state.groupIds.length > 0 ? { groupIds: state.groupIds } : {}),
      ...(state.structureKey ? { structureKey: state.structureKey } : {}),
      ...(state.lensKey ? { lensKey: state.lensKey } : {}),
      ...(state.manualTopicIds.length > 0 ? { manualTopicIds: state.manualTopicIds } : {}),
    },
  }
}
