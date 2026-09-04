import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { stories } from '../db/schema'
import { selectStoryStructure, getStoryStructureByKey, type StoryStructure } from './stages/story-structures'
import { selectCharacterLens, getCharacterLensByKey, type CharacterLens } from './stages/character-lenses'
import { selectVoiceRegister, type VoiceRegister } from './stages/voice-registers'

export interface StoryStructureChoice {
  structure: StoryStructure
  lens: CharacterLens
  voice: VoiceRegister
}

export async function resolveStoryStructureChoice(storyId: number): Promise<StoryStructureChoice> {
  const [row] = await db
    .select({ structureKey: stories.structureKey, lensKey: stories.lensKey })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1)

  const structure = (row?.structureKey ? getStoryStructureByKey(row.structureKey) : undefined) ?? selectStoryStructure(storyId)
  const lens = (row?.lensKey ? getCharacterLensByKey(row.lensKey) : undefined) ?? selectCharacterLens(storyId)
  const voice = selectVoiceRegister(storyId)

  return { structure, lens, voice }
}
