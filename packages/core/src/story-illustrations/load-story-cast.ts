import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { stories, storyUniverses } from '../db/schema.js'
import { loadCharactersWithPortrait, type CharacterWithPortrait } from '../character-portraits/load-characters-with-portrait.js'

export async function loadStoryCast(storyId: number): Promise<CharacterWithPortrait[]> {
  const [story] = await db.select({ groupId: stories.groupId }).from(stories).where(eq(stories.id, storyId))

  const linkRows = await db
    .select({ universeId: storyUniverses.universeId })
    .from(storyUniverses)
    .where(eq(storyUniverses.storyId, storyId))

  const universeIds =
    linkRows.length > 0 ? linkRows.map((r) => r.universeId) : story?.groupId != null ? [story.groupId] : []

  const uniqueUniverseIds = Array.from(new Set(universeIds))

  if (uniqueUniverseIds.length === 0) return []

  const charactersByUniverse = await Promise.all(uniqueUniverseIds.map((id) => loadCharactersWithPortrait(id)))

  const dedupedById = new Map<number, CharacterWithPortrait>()

  for (const characters of charactersByUniverse) {
    for (const character of characters) {
      if (!dedupedById.has(character.id)) dedupedById.set(character.id, character)
    }
  }

  return Array.from(dedupedById.values())
}
