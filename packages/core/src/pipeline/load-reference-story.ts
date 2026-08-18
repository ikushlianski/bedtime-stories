import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { stories } from '../db/schema'

export interface ReferenceStory {
  title: string
  textFinal: string
}

export async function loadReferenceStory(storyId: number): Promise<ReferenceStory | null> {
  const [story] = await db
    .select({ referenceStoryId: stories.referenceStoryId })
    .from(stories)
    .where(eq(stories.id, storyId))

  if (!story || story.referenceStoryId === null) {
    return null
  }

  const [referenced] = await db
    .select({ title: stories.title, textFinal: stories.textFinal })
    .from(stories)
    .where(eq(stories.id, story.referenceStoryId))

  if (!referenced || referenced.textFinal === null) {
    return null
  }

  return { title: referenced.title, textFinal: referenced.textFinal }
}
