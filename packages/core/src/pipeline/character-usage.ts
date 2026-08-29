import { db } from '../db/client'
import { storyCharacters } from '../db/schema'

export async function recordStoryCharacters(storyId: number, characterIds: number[]): Promise<void> {
  if (characterIds.length === 0) return

  await db
    .insert(storyCharacters)
    .values(characterIds.map((characterId) => ({ storyId, characterId })))
    .onConflictDoNothing()
}
