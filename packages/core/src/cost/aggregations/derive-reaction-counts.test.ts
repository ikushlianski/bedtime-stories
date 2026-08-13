import { describe, it, expect } from 'vitest'
import { deriveReactionCountsByStory, emptyReactionCounts, type ReactionCountRow } from './derive-reaction-counts'

describe('deriveReactionCountsByStory', () => {
  it('returns an empty map for empty storyIds and empty rows', () => {
    expect(deriveReactionCountsByStory([], [])).toEqual(new Map())
  })

  it('still includes a storyId with no matching rows, all-zero', () => {
    const result = deriveReactionCountsByStory([1], [])

    expect(result.get(1)).toEqual(emptyReactionCounts())
  })

  it('produces correct per-type counts from rows, leaving other types zero', () => {
    const rows: ReactionCountRow[] = [
      { storyId: 1, type: 'sasha_laughed', count: 3 },
      { storyId: 1, type: 'sasha_loved', count: 1 },
      { storyId: 1, type: 'my_note', count: 2 },
    ]

    const result = deriveReactionCountsByStory([1], rows)

    expect(result.get(1)).toEqual({
      sasha_reaction: 0,
      my_note: 2,
      sasha_laughed: 3,
      sasha_loved: 1,
      sasha_disliked: 0,
    })
  })

  it('never cross-contaminates counts between two different storyIds', () => {
    const rows: ReactionCountRow[] = [
      { storyId: 1, type: 'sasha_laughed', count: 5 },
      { storyId: 2, type: 'sasha_disliked', count: 4 },
    ]

    const result = deriveReactionCountsByStory([1, 2], rows)

    expect(result.get(1)).toEqual({
      sasha_reaction: 0,
      my_note: 0,
      sasha_laughed: 5,
      sasha_loved: 0,
      sasha_disliked: 0,
    })
    expect(result.get(2)).toEqual({
      sasha_reaction: 0,
      my_note: 0,
      sasha_laughed: 0,
      sasha_loved: 0,
      sasha_disliked: 4,
    })
  })

  it('returns a fresh zeroed object from emptyReactionCounts on each call', () => {
    const a = emptyReactionCounts()
    const b = emptyReactionCounts()

    a.sasha_laughed = 9

    expect(b.sasha_laughed).toBe(0)
  })
})
