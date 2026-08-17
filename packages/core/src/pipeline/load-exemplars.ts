import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { stories } from '../db/schema'

export interface Exemplar {
  title: string
  textFinal: string
}

const MAX_MIXED_UNIVERSE_EXEMPLARS = 4

function toExemplar(row: { title: string; textFinal: string | null }): Exemplar | null {
  return row.textFinal !== null ? { title: row.title, textFinal: row.textFinal } : null
}

async function loadRandomExemplarsForSingleUniverse(
  universeIds: number[],
  count: number,
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

    return fallback.map(toExemplar).filter((e): e is Exemplar => e !== null)
  }

  return rows.map(toExemplar).filter((e): e is Exemplar => e !== null)
}

/**
 * When mixing 2+ universes, draw one exemplar from EACH selected universe (capped at
 * MAX_MIXED_UNIVERSE_EXEMPLARS, which matches the app's max universes-per-story limit) instead
 * of one random pooled draw — otherwise a blended story can end up with zero tonal reference to
 * a universe the parent deliberately chose to include.
 */
async function loadRandomExemplarsAcrossUniverses(universeIds: number[]): Promise<Exemplar[]> {
  const baseFilter = and(eq(stories.isLegacy, true), isNotNull(stories.textFinal))

  const perUniverseRows = await Promise.all(
    universeIds.slice(0, MAX_MIXED_UNIVERSE_EXEMPLARS).map((universeId) =>
      db
        .select({ title: stories.title, textFinal: stories.textFinal })
        .from(stories)
        .where(and(baseFilter, eq(stories.groupId, universeId)))
        .orderBy(sql`RANDOM()`)
        .limit(1),
    ),
  )

  return perUniverseRows
    .flat()
    .map(toExemplar)
    .filter((e): e is Exemplar => e !== null)
}

export async function loadRandomExemplars(
  universeIds: number[],
  count: number = 2,
): Promise<Exemplar[]> {
  if (universeIds.length > 1) {
    return loadRandomExemplarsAcrossUniverses(universeIds)
  }

  return loadRandomExemplarsForSingleUniverse(universeIds, count)
}
