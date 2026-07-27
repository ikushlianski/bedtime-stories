import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { stories } from '../db/schema'

export interface Exemplar {
  title: string
  textFinal: string
}

export async function loadRandomExemplars(
  universeIds: number[],
  count: number = 2,
): Promise<Exemplar[]> {
  const baseFilter = and(eq(stories.isLegacy, true), isNotNull(stories.textFinal))

  const filter = universeIds.length > 0
    ? and(baseFilter, inArray(stories.groupId, universeIds))
    : baseFilter

  const rows = await db
    .select({ title: stories.title, textFinal: stories.textFinal })
    .from(stories)
    .where(filter)
    .orderBy(sql`RANDOM()`)
    .limit(count)

  if (rows.length === 0 && universeIds.length > 0) {
    const fallback = await db
      .select({ title: stories.title, textFinal: stories.textFinal })
      .from(stories)
      .where(baseFilter)
      .orderBy(sql`RANDOM()`)
      .limit(count)

    return fallback
      .filter((r): r is Exemplar => r.textFinal !== null)
      .map((r) => ({ title: r.title, textFinal: r.textFinal }))
  }

  return rows
    .filter((r): r is Exemplar => r.textFinal !== null)
    .map((r) => ({ title: r.title, textFinal: r.textFinal }))
}
