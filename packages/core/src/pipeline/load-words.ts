import { eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { words, storyWords } from '../db/schema'
import type { TargetWord } from './stages/words-block'

export * from './stages/words-block'

export async function loadEligibleWords(
  universeId: number | null,
  limit: number = 12,
): Promise<TargetWord[]> {
  const scopeFilter = universeId !== null
    ? or(isNull(words.universeId), eq(words.universeId, universeId))
    : isNull(words.universeId)

  const usedCount = sql<number>`(
    select count(distinct "story_words"."story_id")::int from "story_words"
    join "stories" on "stories"."id" = "story_words"."story_id"
    where "story_words"."word_id" = "words"."id"
      and "stories"."status" in ('proofreading', 'ready', 'read')
  )`

  const rows = await db
    .select({
      id: words.id,
      word: words.word,
      hint: words.hint,
      rank: words.rank,
      usedCount,
    })
    .from(words)
    .where(scopeFilter)
    .orderBy(usedCount, sql`${words.rank} desc`, sql`random()`)
    .limit(limit)

  return rows
}

export async function recordStoryWords(storyId: number, wordIds: number[]): Promise<void> {
  if (wordIds.length === 0) return

  await db
    .insert(storyWords)
    .values(wordIds.map((wordId) => ({ storyId, wordId })))
    .onConflictDoNothing()
}
