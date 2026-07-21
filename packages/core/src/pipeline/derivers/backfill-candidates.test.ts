import { describe, it, expect } from 'vitest'
import { deriveBackfillCandidates } from './backfill-candidates'

describe('deriveBackfillCandidates', () => {
  it('returns ready stories that have no story_images rows yet', () => {
    const result = deriveBackfillCandidates({
      readyStoryIds: [1, 2, 3],
      storyIdsWithImages: [2],
    })

    expect(result).toEqual([1, 3])
  })

  it('returns an empty list when every ready story already has images', () => {
    const result = deriveBackfillCandidates({
      readyStoryIds: [1, 2],
      storyIdsWithImages: [1, 2],
    })

    expect(result).toEqual([])
  })

  it('returns all ready stories when none have images yet', () => {
    const result = deriveBackfillCandidates({
      readyStoryIds: [5, 6],
      storyIdsWithImages: [],
    })

    expect(result).toEqual([5, 6])
  })

  it('is safe to re-run — stories already backfilled drop out on the next call', () => {
    const firstPass = deriveBackfillCandidates({ readyStoryIds: [1, 2], storyIdsWithImages: [] })
    const secondPass = deriveBackfillCandidates({ readyStoryIds: [1, 2], storyIdsWithImages: firstPass })

    expect(secondPass).toEqual([])
  })
})
