import { eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { characterPortraits, characterReferenceImages, modelCalls, universeCharacters } from '@bedtime/core/db/schema'

export async function deleteCharacterCascade(characterId: number): Promise<void> {
  await db.delete(characterReferenceImages).where(eq(characterReferenceImages.characterId, characterId))
  await db.delete(characterPortraits).where(eq(characterPortraits.characterId, characterId))
  await db.delete(modelCalls).where(eq(modelCalls.characterId, characterId))
  await db.delete(universeCharacters).where(eq(universeCharacters.id, characterId))
}
