import { and, eq, gte } from 'drizzle-orm'
import { db } from '../db/client'
import { storyIdeas, topics } from '../db/schema'

function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export async function haveDailySuggestionsRunToday(): Promise<boolean> {
  const cutoff = startOfTodayUtc()

  const [ideaRow] = await db
    .select({ id: storyIdeas.id })
    .from(storyIdeas)
    .where(gte(storyIdeas.createdAt, cutoff))

  if (ideaRow) return true

  const [topicRow] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.status, 'suggested'), gte(topics.createdAt, cutoff)))

  return Boolean(topicRow)
}
