import { eq, inArray } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { storyUniverses } from '@bedtime/core/db/schema'

export const MAX_UNIVERSES_PER_STORY = 4

export async function getStoryUniverseIds(storyId: number, fallbackGroupId?: number | null): Promise<number[]> {
  const rows = await db
    .select({ universeId: storyUniverses.universeId })
    .from(storyUniverses)
    .where(eq(storyUniverses.storyId, storyId))

  if (rows.length > 0) return rows.map((r) => r.universeId)

  return fallbackGroupId != null ? [fallbackGroupId] : []
}

export async function getStoryUniverseIdsBatch(stories: Array<{ id: number; groupId: number | null }>): Promise<Map<number, number[]>> {
  const storyIds = stories.map((s) => s.id)
  const result = new Map<number, number[]>()

  if (storyIds.length === 0) return result

  const rows = await db
    .select({ storyId: storyUniverses.storyId, universeId: storyUniverses.universeId })
    .from(storyUniverses)
    .where(inArray(storyUniverses.storyId, storyIds))

  for (const r of rows) {
    const bucket = result.get(r.storyId) ?? []
    bucket.push(r.universeId)
    result.set(r.storyId, bucket)
  }

  for (const s of stories) {
    if (!result.has(s.id)) {
      result.set(s.id, s.groupId != null ? [s.groupId] : [])
    }
  }

  return result
}

export async function setStoryUniverses(storyId: number, universeIds: number[]): Promise<void> {
  const uniqueIds = Array.from(new Set(universeIds))

  if (uniqueIds.length === 0) return

  await db
    .insert(storyUniverses)
    .values(uniqueIds.map((universeId) => ({ storyId, universeId })))
    .onConflictDoNothing()
}
