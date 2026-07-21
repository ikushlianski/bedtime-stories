export interface DeriveBackfillCandidatesInput {
  readyStoryIds: number[]
  storyIdsWithImages: number[]
}

export function deriveBackfillCandidates(input: DeriveBackfillCandidatesInput): number[] {
  const withImages = new Set(input.storyIdsWithImages)

  return input.readyStoryIds.filter((id) => !withImages.has(id))
}
