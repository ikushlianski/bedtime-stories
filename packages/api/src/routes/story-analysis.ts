import { eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, storyGroups, childDiary, parentReviews, annotations, universeCharacters, universeSuggestions } from '@bedtime/core/db/schema'
import { runStoryAnalyzer } from '@bedtime/core/pipeline/stages/story-analyzer'
import { updateStyleGuide } from '@bedtime/core/pipeline/style-guide-updater'
import { formatParentFeedback } from '@bedtime/core/pipeline/derivers/format-parent-feedback'
import { runUniverseFactExtractor } from '@bedtime/core/pipeline/stages/universe-fact-extractor'
import { embedStory } from '@bedtime/core/pipeline/embed-story'

export interface AnalyzeResult {
  storyAnalysis: string
  reactionsExtracted: number
  styleGuideUpdated: boolean
  suggestionsCreated: number
}

export async function analyzeStoryAndLearn(storyId: number): Promise<AnalyzeResult> {
  const [story] = await db.select().from(stories).where(eq(stories.id, storyId))

  if (!story) {
    throw new Error(`Story ${storyId} not found`)
  }

  const storyText = story.textFinal ?? story.textV2 ?? story.textV1

  if (!storyText) {
    throw new Error(`Story ${storyId} has no text to analyze`)
  }

  embedStory(storyId).catch((err) => {
    console.error(`[analyze] story ${storyId} — embedding failed:`, err)
  })

  let universeContext: string | undefined

  if (story.groupId !== null && story.groupId !== undefined) {
    const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, story.groupId))

    if (group) {
      universeContext = group.universeContext ?? undefined
    }
  }

  console.log(`[analyze] story ${storyId} "${story.title}" — running analyzer`)

  const output = await runStoryAnalyzer({
    storyText,
    ...(universeContext !== undefined ? { universeContext } : {}),
  })

  console.log(`[analyze] story ${storyId} — reactions: ${output.extracted_reactions.length}, saving analysis`)

  await db
    .update(stories)
    .set({ storyAnalysis: output.analysis_summary })
    .where(eq(stories.id, storyId))

  if (output.extracted_reactions.length > 0) {
    await db.insert(childDiary).values(
      output.extracted_reactions.map((r) => ({
        content: `Из истории «${story.title}»: ${r.reaction_text} — «${r.surrounding_quote}»`,
      })),
    )
  }

  let suggestionsCreated = 0

  if (story.groupId !== null && story.groupId !== undefined) {
    const groupId = story.groupId

    console.log(`[analyze] story ${storyId} — updating style guide for group ${groupId}`)
    const [existingChars, parentReview, storyAnnotations] = await Promise.all([
      db
        .select({ name: universeCharacters.name, description: universeCharacters.description })
        .from(universeCharacters)
        .where(eq(universeCharacters.universeId, groupId)),
      db.select().from(parentReviews).where(eq(parentReviews.storyId, storyId)),
      db.select().from(annotations).where(eq(annotations.storyId, storyId)),
    ])

    const parentFeedback = formatParentFeedback({ review: parentReview[0] ?? null, annotations: storyAnnotations })

    await Promise.all([
      updateStyleGuide(groupId, output, story.title, parentFeedback),
      runUniverseFactExtractor({ storyText, existingCharacters: existingChars })
        .then(async (factOutput) => {
          if (factOutput.facts.length === 0) return

          await db.insert(universeSuggestions).values(
            factOutput.facts.map((f) => ({
              universeId: groupId,
              factText: f.fact_text,
              sourceStoryId: storyId,
              status: 'pending' as const,
            })),
          )
          suggestionsCreated = factOutput.facts.length
        })
        .catch((err) => {
          console.error(`[analyze] story ${storyId} — fact extractor failed:`, err)
        }),
    ])
  }

  console.log(`[analyze] story ${storyId} — done`)

  return {
    storyAnalysis: output.analysis_summary,
    reactionsExtracted: output.extracted_reactions.length,
    styleGuideUpdated: story.groupId !== null && story.groupId !== undefined,
    suggestionsCreated,
  }
}

export function triggerAnalysis(storyId: number): void {
  void analyzeStoryAndLearn(storyId).catch((err) => {
    console.error(`[analyze] background analysis failed for storyId=${storyId}:`, err)
  })
}
