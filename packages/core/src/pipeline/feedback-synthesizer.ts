import { desc, eq, and, inArray, isNotNull } from 'drizzle-orm'
import { db } from '../db/client'
import { feedback, childDiary, childProfiles, stories, annotations } from '../db/schema'
import { aiRunner } from '../ai'
import { resolveStageModel } from './derivers/resolve-stage-model'
import { buildSynthesizerPrompt, SIGNAL_WEIGHTS } from './synthesizer-prompt-builder'

export { SIGNAL_WEIGHTS }

export async function synthesizeSashaContext(): Promise<string | null> {
  const [recentFeedback, recentDiary, recentStories, [profile], recentAnnotations] = await Promise.all([
    db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(5),
    db.select().from(childDiary).orderBy(desc(childDiary.createdAt)).limit(10),
    db
      .select({ id: stories.id, title: stories.title, storyAnalysis: stories.storyAnalysis })
      .from(stories)
      .where(and(inArray(stories.status, ['ready', 'read']), isNotNull(stories.storyAnalysis)))
      .orderBy(desc(stories.createdAt))
      .limit(30),
    db.select().from(childProfiles).limit(1),
    db
      .select({
        type: annotations.type,
        selectedText: annotations.selectedText,
        noteText: annotations.noteText,
        context: annotations.context,
        storyTitle: stories.title,
      })
      .from(annotations)
      .innerJoin(stories, eq(annotations.storyId, stories.id))
      .where(
        and(
          inArray(stories.status, ['ready', 'read']),
          inArray(annotations.type, ['sasha_laughed', 'sasha_loved', 'sasha_disliked', 'sasha_reaction', 'my_note']),
        ),
      )
      .orderBy(desc(stories.createdAt))
      .limit(80),
  ])

  const hasProfile = !!profile && (profile.name || profile.activities || profile.interests || profile.dislikes || profile.favourites || profile.notes)
  const hasFeedback = recentFeedback.length > 0
  const hasDiary = recentDiary.length > 0
  const hasAnnotations = recentAnnotations.length > 0

  if (!hasProfile && !hasFeedback && !hasDiary && !hasAnnotations) {
    return null
  }

  const parentNotesOnText = recentAnnotations
    .filter((a) => a.type === 'my_note' && a.context === 'text')
    .map((a) => ({ selectedText: a.selectedText, noteText: a.noteText, storyTitle: a.storyTitle }))

  const parentNotesOnPlan = recentAnnotations
    .filter((a) => a.type === 'my_note' && a.context === 'plan')
    .map((a) => ({ selectedText: a.selectedText, noteText: a.noteText, storyTitle: a.storyTitle }))

  const sashaLaughed = recentAnnotations
    .filter((a) => a.type === 'sasha_laughed')
    .map((a) => ({ selectedText: a.selectedText, noteText: a.noteText, storyTitle: a.storyTitle }))

  const sashaLoved = recentAnnotations
    .filter((a) => a.type === 'sasha_loved')
    .map((a) => ({ selectedText: a.selectedText, noteText: a.noteText, storyTitle: a.storyTitle }))

  const sashaDisliked = recentAnnotations
    .filter((a) => a.type === 'sasha_disliked')
    .map((a) => ({ selectedText: a.selectedText, noteText: a.noteText, storyTitle: a.storyTitle }))

  const sashaReactions = recentAnnotations
    .filter((a) => a.type === 'sasha_reaction')
    .map((a) => ({ selectedText: a.selectedText, noteText: a.noteText, storyTitle: a.storyTitle }))

  const storyAnalyses = recentStories
    .map((s) => `«${s.title}»: ${s.storyAnalysis}`)
    .slice(0, 30)

  const structuredFeedback = recentFeedback.map((f) => {
    const sf = f.structuredFeedback
    return {
      rating: f.rating ?? null,
      comment: f.comment ?? null,
      enjoyed: sf?.enjoyed ?? null,
      was_funny: sf?.was_funny ?? null,
      too_long: sf?.too_long ?? null,
      favorite_moment: sf?.favorite_moment ?? null,
      favorite_character: sf?.favorite_character ?? null,
      want_again: sf?.want_again ?? null,
      notes: sf?.notes ?? null,
    }
  })

  const prompt = buildSynthesizerPrompt({
    profile: hasProfile
      ? {
        name: profile.name ?? null,
        age: profile.age ?? null,
        activities: profile.activities ?? null,
        interests: profile.interests ?? null,
        dislikes: profile.dislikes ?? null,
        favourites: profile.favourites ?? null,
        notes: profile.notes ?? null,
      }
      : null,
    parentNotesOnText,
    parentNotesOnPlan,
    sashaLaughed,
    sashaLoved,
    sashaDisliked,
    structuredFeedback,
    sashaReactions,
    diaryEntries: recentDiary.map((d) => d.content),
    storyAnalyses,
    recentTitles: recentStories.filter((s) => s.title).map((s) => s.title),
  })

  const choice = await resolveStageModel(null, 'feedbackSynthesizer')

  return aiRunner.runText({
    model: choice.model,
    fallback: choice.fallback,
    prompt,
    label: 'feedback-synthesizer',
    stage: 'feedbackSynthesizer',
  })
}
