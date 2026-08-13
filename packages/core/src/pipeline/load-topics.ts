import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { topics, storyTopics } from '../db/schema'
import type { EligibleTopic } from './topics-prompt'

export * from './topics-prompt'

const usedCountForFinishedStories = sql<number>`(
  select count(distinct "story_topics"."story_id")::int from "story_topics"
  join "stories" on "stories"."id" = "story_topics"."story_id"
  where "story_topics"."topic_id" = "topics"."id"
    and "stories"."status" in ('proofreading', 'ready', 'read')
)`

export async function loadEligibleTopics(
  universeIds: number[],
  storyId: number,
  limit: number = 6,
): Promise<EligibleTopic[]> {
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(storyTopics)
    .where(eq(storyTopics.storyId, storyId))

  if (existing && existing.count > 0) return []

  const scopeFilter = and(
    eq(topics.status, 'active'),
    universeIds.length > 0
      ? or(isNull(topics.universeId), inArray(topics.universeId, universeIds))
      : isNull(topics.universeId),
  )

  const rows = await db
    .select({
      id: topics.id,
      title: topics.title,
      note: topics.note,
      rank: topics.rank,
      usedCount: usedCountForFinishedStories,
    })
    .from(topics)
    .where(scopeFilter)
    .orderBy(usedCountForFinishedStories, sql`${topics.rank} desc`, sql`random()`)
    .limit(limit)

  return rows
}

export async function loadTopicsByIds(topicIds: number[]): Promise<EligibleTopic[]> {
  if (topicIds.length === 0) return []

  const rows = await db
    .select({
      id: topics.id,
      title: topics.title,
      note: topics.note,
      rank: topics.rank,
      usedCount: usedCountForFinishedStories,
    })
    .from(topics)
    .where(and(eq(topics.status, 'active'), inArray(topics.id, topicIds)))

  return rows
}

export async function recordStoryTopics(storyId: number, topicIds: number[]): Promise<void> {
  if (topicIds.length === 0) return

  await db
    .insert(storyTopics)
    .values(topicIds.map((topicId) => ({ storyId, topicId })))
    .onConflictDoNothing()
}
