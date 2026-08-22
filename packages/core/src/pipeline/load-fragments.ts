import { eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { fragments, storyFragments } from '../db/schema'
import type { EligibleFragment } from './fragments-prompt'

export * from './fragments-prompt'

export async function loadEligibleFragments(
  universeIds: number[],
  limit: number = 12,
): Promise<EligibleFragment[]> {
  const scopeFilter = universeIds.length > 0
    ? or(isNull(fragments.universeId), inArray(fragments.universeId, universeIds))
    : isNull(fragments.universeId)

  const usedCount = sql<number>`(
    select count(distinct "story_fragments"."story_id")::int from "story_fragments"
    join "stories" on "stories"."id" = "story_fragments"."story_id"
    where "story_fragments"."fragment_id" = "fragments"."id"
      and "stories"."status" in ('proofreading', 'ready', 'read')
  )`

  const rows = await db
    .select({
      id: fragments.id,
      text: fragments.text,
      rank: fragments.rank,
      usedCount,
      exactQuote: fragments.exactQuote,
    })
    .from(fragments)
    .where(scopeFilter)
    .orderBy(usedCount, sql`${fragments.rank} desc`, sql`random()`)
    .limit(limit)

  return rows
}

export interface ChosenFragment {
  text: string
  exactQuote: boolean
}

export async function loadFragmentTexts(fragmentIds: number[]): Promise<ChosenFragment[]> {
  if (fragmentIds.length === 0) return []

  const rows = await db
    .select({ id: fragments.id, text: fragments.text, exactQuote: fragments.exactQuote })
    .from(fragments)
    .where(inArray(fragments.id, fragmentIds))

  const byId = new Map(rows.map((r) => [r.id, { text: r.text, exactQuote: r.exactQuote }]))

  return fragmentIds.map((id) => byId.get(id)).filter((f): f is ChosenFragment => f !== undefined)
}

export async function loadStoryFragmentTexts(storyId: number): Promise<ChosenFragment[]> {
  const rows = await db
    .select({ text: fragments.text, exactQuote: fragments.exactQuote })
    .from(storyFragments)
    .innerJoin(fragments, eq(fragments.id, storyFragments.fragmentId))
    .where(eq(storyFragments.storyId, storyId))

  return rows
}

export async function recordStoryFragments(storyId: number, fragmentIds: number[]): Promise<void> {
  if (fragmentIds.length === 0) return

  await db
    .insert(storyFragments)
    .values(fragmentIds.map((fragmentId) => ({ storyId, fragmentId })))
    .onConflictDoNothing()
}
