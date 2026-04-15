import type { CreateStoryInput } from '../lib/api'

export type CreateStoryMode = 'generate' | 'paste'

export interface CreateStoryFormState {
  mode: CreateStoryMode
  seed: string
  title: string
  textFinal: string
  groupId: number | null
}

export const INITIAL_CREATE_STORY_FORM: CreateStoryFormState = {
  mode: 'generate',
  seed: '',
  title: '',
  textFinal: '',
  groupId: null,
}

export type CreateStoryFormValidation =
  | { valid: true; input: CreateStoryInput }
  | { valid: false; reason: string }

export function validateCreateStoryForm(state: CreateStoryFormState): CreateStoryFormValidation {
  const groupId = state.groupId ?? undefined

  if (state.mode === 'generate') {
    const seed = state.seed.trim()

    if (!seed) {
      return { valid: false, reason: 'Seed is required' }
    }

    if (seed.length > 5000) {
      return { valid: false, reason: 'Seed is too long' }
    }

    return { valid: true, input: { seed, ...(groupId !== undefined ? { groupId } : {}) } }
  }

  const textFinal = state.textFinal.trim()

  if (!textFinal) {
    return { valid: false, reason: 'Story text is required' }
  }

  const title = state.title.trim()

  if (title.length > 200) {
    return { valid: false, reason: 'Title is too long' }
  }

  if (title.length === 0) {
    return { valid: true, input: { textFinal, ...(groupId !== undefined ? { groupId } : {}) } }
  }

  return { valid: true, input: { title, textFinal, ...(groupId !== undefined ? { groupId } : {}) } }
}
