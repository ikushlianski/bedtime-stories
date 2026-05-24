import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { stories } from '../db/schema'

export interface Exemplar {
  title: string
  textFinal: string
}

export async function loadRandomExemplars(
  universeId: number | null,
  count: number = 2,
): Promise<Exemplar[]> {
  const baseFilter = and(eq(stories.isLegacy, true), isNotNull(stories.textFinal))

  const filter = universeId !== null
    ? and(baseFilter, eq(stories.groupId, universeId))
    : baseFilter

  const rows = await db
    .select({ title: stories.title, textFinal: stories.textFinal })
    .from(stories)
    .where(filter)
    .orderBy(sql`RANDOM()`)
    .limit(count)

  if (rows.length === 0 && universeId !== null) {
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
