import { eq, isNull, or } from 'drizzle-orm'
import { db } from '../db/client'
import { topics, storyGroups } from '../db/schema'
import { suggestTopicCandidates } from './stages/topic-candidate-suggester'

export interface GenerateTopicCandidatesResult {
  createdCount: number
  createdIds: number[]
}

export class UniverseNotFoundError extends Error {
  constructor(readonly universeId: number) {
    super(`Universe ${universeId} not found`)
  }
}

const MAX_CANDIDATES_PER_RUN = 4
const MAX_TITLE_LENGTH = 200
const DEGENERATE_REPEAT_PATTERN = /(.)\1{4,}/

export function isPlausibleTopicTitle(title: string): boolean {
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) return false
  if (DEGENERATE_REPEAT_PATTERN.test(title)) return false

  return true
}

export async function generateTopicCandidatesForUniverse(
  universeId: number,
  model?: string,
): Promise<GenerateTopicCandidatesResult> {
  const [universe] = await db.select().from(storyGroups).where(eq(storyGroups.id, universeId))

  if (!universe) {
    throw new UniverseNotFoundError(universeId)
  }

  const existingTopics = await db
    .select({ title: topics.title })
    .from(topics)
    .where(or(isNull(topics.universeId), eq(topics.universeId, universeId)))

  const seenTitles = new Set(existingTopics.map((t) => t.title.trim().toLowerCase()))

  const output = await suggestTopicCandidates({
    universeContext: universe.universeContext || '',
    universeStyleGuide: universe.styleGuide ? universe.styleGuide : undefined,
    existingTitles: [...seenTitles],
    ...(model !== undefined ? { model } : {}),
  })

  const createdIds: number[] = []

  for (const candidate of output.topics) {
    if (createdIds.length >= MAX_CANDIDATES_PER_RUN) break

    const title = candidate.title.trim()
    const key = title.toLowerCase()

    if (!isPlausibleTopicTitle(title) || seenTitles.has(key)) continue

    seenTitles.add(key)

    const [created] = await db
      .insert(topics)
      .values({
        title,
        note: candidate.note?.trim() || null,
        universeId,
        status: 'suggested',
      })
      .returning({ id: topics.id })

    if (created) {
      createdIds.push(created.id)
    }
  }

  return { createdCount: createdIds.length, createdIds }
}
