const REFERENCE_STORY_URL_PATTERN = /\/stories\/(\d+)/

export function extractReferenceStoryIdFromSeed(seed: string): number | null {
  const match = seed.match(REFERENCE_STORY_URL_PATTERN)

  return match?.[1] ? parseInt(match[1], 10) : null
}
