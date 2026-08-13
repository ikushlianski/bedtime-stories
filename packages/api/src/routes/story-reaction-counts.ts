import { and, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { annotations } from '@bedtime/core/db/schema'
import { deriveReactionCountsByStory, type ReactionCounts } from '@bedtime/core/cost/aggregations/derive-reaction-counts'

export async function getReactionCountsBatch(storyIds: number[]): Promise<Map<number, ReactionCounts>> {
  if (storyIds.length === 0) return new Map()

  const rows = await db
    .select({
      storyId: annotations.storyId,
      type: annotations.type,
      count: sql<number>`count(*)::int`,
    })
    .from(annotations)
    .where(
      and(
        inArray(annotations.storyId, storyIds),
        or(isNull(annotations.context), ne(annotations.context, 'plan')),
      ),
    )
    .groupBy(annotations.storyId, annotations.type)

  return deriveReactionCountsByStory(
    storyIds,
    rows
      .filter((r) => r.storyId !== null)
      .map((r) => ({ storyId: r.storyId as number, type: r.type, count: r.count })),
  )
}
