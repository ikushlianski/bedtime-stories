import { and, desc, eq, ne } from 'drizzle-orm'
import { db } from '../db/client.js'
import { characterPortraits, characterReferenceImages, universeCharacters } from '../db/schema.js'
import { MAX_SIBLING_PORTRAITS } from './derive-reference-tier.js'

export interface LoadPortraitCandidatesInput {
  characterId: number
  universeId: number
}

export interface PortraitCandidates {
  ownReferenceValues: string[]
  siblingPortraitValues: string[]
}

export async function loadPortraitCandidates(input: LoadPortraitCandidatesInput): Promise<PortraitCandidates> {
  const [ownRefs, siblings] = await Promise.all([
    db
      .select({ storagePath: characterReferenceImages.storagePath })
      .from(characterReferenceImages)
      .where(eq(characterReferenceImages.characterId, input.characterId)),
    db
      .select({ storagePath: characterPortraits.storagePath })
      .from(characterPortraits)
      .innerJoin(universeCharacters, eq(characterPortraits.characterId, universeCharacters.id))
      .where(
        and(
          eq(universeCharacters.universeId, input.universeId),
          eq(characterPortraits.isCurrent, true),
          ne(characterPortraits.characterId, input.characterId),
        ),
      )
      .orderBy(desc(characterPortraits.generatedAt))
      .limit(MAX_SIBLING_PORTRAITS),
  ])

  return {
    ownReferenceValues: ownRefs.map((r) => r.storagePath),
    siblingPortraitValues: siblings.map((r) => r.storagePath),
  }
}
