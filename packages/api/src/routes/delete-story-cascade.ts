import { eq, sql } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import {
  stories,
  annotations,
  feedback,
  runSnapshots,
  planQuestions,
  planConversations,
  parentReviews,
  childReactions,
  storyReadings,
  modelCalls,
  storyTextVersions,
  storyEmbeddings,
  storyUniverses,
  storyFragments,
  storyWords,
  storyTopics,
  storyComments,
  modelSwapEvents,
  valueForMoneyFeedback,
  universeSuggestions,
  storyIllustrations,
  storyIllustrationMarkers,
} from '@bedtime/core/db/schema'

export async function deleteStoryCascade(storyId: number): Promise<void> {
  await db.update(universeSuggestions).set({ sourceStoryId: null }).where(eq(universeSuggestions.sourceStoryId, storyId))
  await db.execute(sql`delete from character_memories where story_id = ${storyId}`)
  await db.delete(annotations).where(eq(annotations.storyId, storyId))
  await db.delete(runSnapshots).where(eq(runSnapshots.storyId, storyId))
  await db.delete(feedback).where(eq(feedback.storyId, storyId))
  await db.delete(planQuestions).where(eq(planQuestions.storyId, storyId))
  await db.delete(planConversations).where(eq(planConversations.storyId, storyId))
  await db.delete(storyReadings).where(eq(storyReadings.storyId, storyId))
  await db.delete(modelCalls).where(eq(modelCalls.storyId, storyId))
  await db.delete(modelSwapEvents).where(eq(modelSwapEvents.storyId, storyId))
  await db.delete(valueForMoneyFeedback).where(eq(valueForMoneyFeedback.storyId, storyId))
  await db.delete(storyComments).where(eq(storyComments.storyId, storyId))
  await db.delete(parentReviews).where(eq(parentReviews.storyId, storyId))
  await db.delete(childReactions).where(eq(childReactions.storyId, storyId))
  await db.delete(storyFragments).where(eq(storyFragments.storyId, storyId))
  await db.delete(storyWords).where(eq(storyWords.storyId, storyId))
  await db.delete(storyTopics).where(eq(storyTopics.storyId, storyId))
  await db.delete(storyTextVersions).where(eq(storyTextVersions.storyId, storyId))
  await db.delete(storyEmbeddings).where(eq(storyEmbeddings.storyId, storyId))
  await db.delete(storyUniverses).where(eq(storyUniverses.storyId, storyId))
  await db.delete(storyIllustrations).where(eq(storyIllustrations.storyId, storyId))
  await db.delete(storyIllustrationMarkers).where(eq(storyIllustrationMarkers.storyId, storyId))
  await db.delete(stories).where(eq(stories.id, storyId))
}
