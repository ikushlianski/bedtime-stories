export type ReactionCounts = Record<
  'sasha_reaction' | 'my_note' | 'sasha_laughed' | 'sasha_loved' | 'sasha_disliked',
  number
>

export interface ReactionCountRow {
  storyId: number
  type: keyof ReactionCounts
  count: number
}

export function emptyReactionCounts(): ReactionCounts {
  return {
    sasha_reaction: 0,
    my_note: 0,
    sasha_laughed: 0,
    sasha_loved: 0,
    sasha_disliked: 0,
  }
}

export function deriveReactionCountsByStory(
  storyIds: number[],
  rows: ReactionCountRow[],
): Map<number, ReactionCounts> {
  const result = new Map<number, ReactionCounts>()

  for (const id of storyIds) {
    result.set(id, emptyReactionCounts())
  }

  for (const row of rows) {
    const counts = result.get(row.storyId)

    if (counts) {
      counts[row.type] = row.count
    }
  }

  return result
}
