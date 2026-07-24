export interface DeriveImageStoragePathInput {
  universeId: number | null
  storyId: number
  sequenceIndex: number
}

export function deriveImageStoragePath(input: DeriveImageStoragePathInput): string {
  const universeSegment = input.universeId !== null ? `universe-${input.universeId}` : 'no-universe'

  return `story-images/${universeSegment}/story-${input.storyId}/scene-${input.sequenceIndex}.png`
}
