import { and, eq, isNull, or } from 'drizzle-orm'
import { db } from '../db/client'
import { topics } from '../db/schema'
import { suggestLiveTopics } from './stages/live-topic-suggester'
import { recommendCheapestModel } from '../openrouter/recommend-model'

export interface LiveTopicSuggestion {
  id: number
  title: string
  note: string | null
}

export const MIN_OUTLINE_LENGTH = 20
export const MAX_LIVE_TOPIC_SUGGESTIONS = 4

export function matchSuggestedTopicIds(
  candidateIds: number[],
  pool: LiveTopicSuggestion[],
): LiveTopicSuggestion[] {
  const poolById = new Map(pool.map((t) => [t.id, t]))
  const seenIds = new Set<number>()
  const suggestions: LiveTopicSuggestion[] = []

  for (const id of candidateIds) {
    if (seenIds.has(id)) continue

    const match = poolById.get(id)

    if (!match) continue

    seenIds.add(id)
    suggestions.push(match)

    if (suggestions.length >= MAX_LIVE_TOPIC_SUGGESTIONS) break
  }

  return suggestions
}

export async function suggestLiveTopicsForOutline(
  universeId: number,
  outline: string,
): Promise<LiveTopicSuggestion[]> {
  const trimmedOutline = outline.trim()

  if (trimmedOutline.length < MIN_OUTLINE_LENGTH) return []

  const pool = await db
    .select({ id: topics.id, title: topics.title, note: topics.note })
    .from(topics)
    .where(and(eq(topics.status, 'active'), or(isNull(topics.universeId), eq(topics.universeId, universeId))))

  if (pool.length === 0) return []

  const model = await recommendCheapestModel({ needsJsonSchema: true, minOutputTokens: 300 })

  if (!model) return []

  const output = await suggestLiveTopics({ outline: trimmedOutline, topics: pool, model })

  return matchSuggestedTopicIds(output.topicIds, pool)
}
