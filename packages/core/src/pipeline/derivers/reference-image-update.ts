export interface DeriveReferenceImageUpdateInput {
  currentReferenceImagePath: string | null
  newSuccessPath: string
}

export interface ReferenceImageUpdateDecision {
  shouldUpdate: boolean
  newPath: string | null
}

export function deriveReferenceImageUpdate(
  input: DeriveReferenceImageUpdateInput,
): ReferenceImageUpdateDecision {
  if (input.currentReferenceImagePath !== null) {
    return { shouldUpdate: false, newPath: null }
  }

  return { shouldUpdate: true, newPath: input.newSuccessPath }
}
