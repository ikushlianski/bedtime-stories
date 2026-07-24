import type { CreateStoryInput } from '../lib/api'

export interface CreateStoryFormState {
  seed: string
  groupId: number | null
  structureKey: string | null
  lensKey: string | null
}

export const INITIAL_CREATE_STORY_FORM: CreateStoryFormState = {
  seed: '',
  groupId: null,
  structureKey: null,
  lensKey: null,
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

  if (state.groupId === null) {
    return { valid: false, reason: 'Universe is required' }
  }

  return {
    valid: true,
    input: {
      seed,
      pipelineMode: 'auto',
      groupId: state.groupId,
      ...(state.structureKey ? { structureKey: state.structureKey } : {}),
      ...(state.lensKey ? { lensKey: state.lensKey } : {}),
    },
  }
}
