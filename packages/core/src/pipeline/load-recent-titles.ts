import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { stories } from '../db/schema'

export const RECENT_TITLES_LIMIT = 12

export async function loadRecentTitles(
  universeId: number | null,
  excludeStoryId?: number,
): Promise<string[]> {
  if (universeId === null) {
    return []
  }

  const conditions = [
    eq(stories.groupId, universeId),
    sql`trim(${stories.title}) <> ''`,
    ...(excludeStoryId !== undefined ? [ne(stories.id, excludeStoryId)] : []),
  ]

  const rows = await db
    .select({ title: stories.title })
    .from(stories)
    .where(and(...conditions))
    .orderBy(desc(stories.createdAt))
    .limit(RECENT_TITLES_LIMIT)

  return rows.map((row) => row.title)
}
