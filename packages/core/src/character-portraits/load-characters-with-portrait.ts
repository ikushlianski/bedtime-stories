import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { characterPortraits, universeCharacters } from '../db/schema.js'
import type { UniverseCharacter } from '../db/types.js'
import type { PortraitTier } from './derive-reference-tier.js'

export interface CurrentPortraitInfo {
  storagePath: string
  tier: PortraitTier
  generatedAt: Date | null
}

export interface CharacterWithPortrait extends UniverseCharacter {
  currentPortrait: CurrentPortraitInfo | null
}

export async function loadCharactersWithPortrait(universeId: number): Promise<CharacterWithPortrait[]> {
  const characters = await db.select().from(universeCharacters).where(eq(universeCharacters.universeId, universeId))

  if (characters.length === 0) return []

  const characterIds = characters.map((c) => c.id)

  const portraitRows = await db
    .select()
    .from(characterPortraits)
    .where(and(inArray(characterPortraits.characterId, characterIds), eq(characterPortraits.isCurrent, true)))

  const currentByCharacterId = new Map<number, (typeof portraitRows)[number]>()

  for (const row of portraitRows) {
    const existing = currentByCharacterId.get(row.characterId)
    const rowTime = row.generatedAt?.getTime() ?? 0
    const existingTime = existing?.generatedAt?.getTime() ?? -1

    if (!existing || rowTime > existingTime) {
      currentByCharacterId.set(row.characterId, row)
    }
  }

  return characters.map((character) => {
    const portrait = currentByCharacterId.get(character.id)

    return {
      ...character,
      currentPortrait: portrait
        ? { storagePath: portrait.storagePath, tier: portrait.tier, generatedAt: portrait.generatedAt }
        : null,
    }
  })
}
