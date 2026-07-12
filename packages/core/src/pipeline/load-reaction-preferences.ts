import { desc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { childReactions, stories } from '../db/schema'
import {
  REACTION_WINDOW,
  summarizeReactions,
  type ReactionRow,
  type ReactionSummary,
} from './stages/reaction-preferences'

export * from './stages/reaction-preferences'

export async function loadReactionPreferences(
  universeId: number | null,
): Promise<ReactionSummary> {
  if (universeId === null) {
    return summarizeReactions([])
  }

  const rows = await db
    .select({
      enjoyed: childReactions.enjoyed,
      wasFunny: childReactions.wasFunny,
      wasScary: childReactions.wasScary,
      tooLong: childReactions.tooLong,
      wantAgain: childReactions.wantAgain,
      favoriteMoment: childReactions.favoriteMoment,
      favoriteCharacter: childReactions.favoriteCharacter,
    })
    .from(childReactions)
    .innerJoin(stories, eq(childReactions.storyId, stories.id))
    .where(eq(stories.groupId, universeId))
    .orderBy(desc(childReactions.createdAt))
    .limit(REACTION_WINDOW)

  return summarizeReactions(rows as ReactionRow[])
}
