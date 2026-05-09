import { desc, eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/client'
import { stories, annotations, feedback } from '../db/schema'
import { aiRunner } from '../ai'
import { resolveStageModel } from './derivers/resolve-stage-model'

export interface UniverseMemory {
  works: string
  doesntWork: string
  techniques: string
  minimize: string
}

export async function synthesizeUniverseMemory(universeId: number): Promise<UniverseMemory | null> {
  const universeStories = await db
    .select({ id: stories.id, title: stories.title })
    .from(stories)
    .where(and(eq(stories.groupId, universeId), inArray(stories.status, ['ready', 'read'])))
    .orderBy(desc(stories.createdAt))
    .limit(50)

  if (universeStories.length === 0) return null

  const storyIds = universeStories.map((s) => s.id)

  const [recentAnnotations, recentFeedback] = await Promise.all([
    db
      .select({
        type: annotations.type,
        selectedText: annotations.selectedText,
        noteText: annotations.noteText,
        storyTitle: stories.title,
      })
      .from(annotations)
      .innerJoin(stories, eq(annotations.storyId, stories.id))
      .where(
        and(
          inArray(annotations.storyId, storyIds),
          inArray(annotations.type, ['sasha_laughed', 'sasha_loved', 'sasha_disliked', 'sasha_reaction', 'my_note']),
        ),
      )
      .orderBy(desc(stories.createdAt))
      .limit(100),
    db
      .select()
      .from(feedback)
      .where(inArray(feedback.storyId, storyIds))
      .orderBy(desc(feedback.createdAt))
      .limit(20),
  ])

  if (recentAnnotations.length === 0 && recentFeedback.length === 0) return null

  const prompt = buildPrompt(universeStories, recentAnnotations, recentFeedback)
  const choice = await resolveStageModel(null, 'feedbackSynthesizer')

  const raw = await aiRunner.runText({
    model: choice.model,
    fallback: choice.fallback,
    prompt,
    label: 'universe-memory-synthesizer',
    stage: 'feedbackSynthesizer',
  })

  if (!raw) return null

  return parseOutput(raw)
}

type StoryRow = { id: number; title: string | null }
type AnnotationRow = { type: string; selectedText: string | null; noteText: string | null; storyTitle: string | null }
type FeedbackRow = { rating: number | null; comment: string | null; structuredFeedback: Record<string, unknown> | null }

function buildPrompt(storyRows: StoryRow[], annotationRows: AnnotationRow[], feedbackRows: FeedbackRow[]): string {
  const storyList = storyRows.map((s) => `- «${s.title ?? 'Без названия'}»`).join('\n')

  const annotationLines = annotationRows
    .map((a) => {
      const tag = a.type === 'sasha_laughed' ? '😂 Засмеялся'
        : a.type === 'sasha_loved' ? '❤️ Понравилось'
        : a.type === 'sasha_disliked' ? '😒 Не понравилось'
        : a.type === 'sasha_reaction' ? '💬 Реакция'
        : '📝 Заметка родителя'
      const text = a.selectedText ? `«${a.selectedText}»` : ''
      const note = a.noteText ? ` — ${a.noteText}` : ''
      return `[${a.storyTitle ?? '?'}] ${tag}: ${text}${note}`
    })
    .join('\n')

  const feedbackLines = feedbackRows
    .map((f) => {
      const parts: string[] = []
      if (f.rating) parts.push(`Оценка: ${f.rating}/5`)
      if (f.comment) parts.push(`Комментарий: ${f.comment}`)
      const sf = f.structuredFeedback
      if (sf) {
        if (sf['favorite_character']) parts.push(`Любимый персонаж: ${sf['favorite_character']}`)
        if (sf['favorite_moment']) parts.push(`Любимый момент: ${sf['favorite_moment']}`)
        if (sf['too_long']) parts.push('Слишком длинно')
        if (sf['notes']) parts.push(`Заметки: ${sf['notes']}`)
      }
      return parts.join('; ')
    })
    .filter(Boolean)
    .join('\n')

  return `Ты анализируешь реакции ребёнка на серию сказок из одной вселенной, чтобы выявить паттерны и сформулировать рекомендации для будущих историй.

НАПИСАННЫЕ ИСТОРИИ (${storyRows.length} шт.):
${storyList}

РЕАКЦИИ И ЗАМЕТКИ:
${annotationLines || '(нет данных)'}

ОБРАТНАЯ СВЯЗЬ:
${feedbackLines || '(нет данных)'}

На основе этих данных сформулируй краткие, конкретные рекомендации для автора будущих историй в этой вселенной.

Ответь строго в формате JSON (без markdown):
{
  "works": "Что работает хорошо — темы, персонажи, ситуации, которые нравятся ребёнку",
  "doesntWork": "Что не работает — темы, элементы, которые вызывают скуку или негативную реакцию",
  "techniques": "Конкретные приёмы повествования, которые показали себя хорошо",
  "minimize": "Что стоит минимизировать или избегать в будущих историях"
}`
}

function parseOutput(raw: string): UniverseMemory | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const works = typeof parsed['works'] === 'string' ? parsed['works'] : ''
    const doesntWork = typeof parsed['doesntWork'] === 'string' ? parsed['doesntWork'] : ''
    const techniques = typeof parsed['techniques'] === 'string' ? parsed['techniques'] : ''
    const minimize = typeof parsed['minimize'] === 'string' ? parsed['minimize'] : ''
    if (!works && !doesntWork && !techniques && !minimize) return null
    return { works, doesntWork, techniques, minimize }
  } catch {
    return null
  }
}
