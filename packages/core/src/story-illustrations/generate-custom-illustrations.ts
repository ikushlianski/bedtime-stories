import { randomUUID } from 'node:crypto'
import { and, count as sqlCount, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { stories, storyIllustrations } from '../db/schema.js'
import type { StoryIllustration } from '../db/types.js'
import { aiRunner } from '../ai/index.js'
import type { ObjectStorage } from '../storage/object-storage.interface.js'
import { ILLUSTRATION_MODEL } from './generate-illustration-album.js'
import { buildStoryIllustrationAssetPath } from './build-story-illustration-asset-path.js'

export const CUSTOM_ILLUSTRATION_ORDER_INDEX_BASE = 1000
export const MAX_CUSTOM_ILLUSTRATION_COUNT = 6
export const DEFAULT_CUSTOM_ILLUSTRATION_COUNT = 2

export interface GenerateCustomIllustrationsInput {
  storyId: number
  prompt: string
  count: number
}

function mediaTypeToExtension(mediaType: string): string {
  if (mediaType.includes('jpeg')) return 'jpg'
  if (mediaType.includes('webp')) return 'webp'
  return 'png'
}

export async function generateCustomIllustrations(
  input: GenerateCustomIllustrationsInput,
  storage: ObjectStorage,
): Promise<StoryIllustration[]> {
  const [story] = await db.select({ id: stories.id }).from(stories).where(eq(stories.id, input.storyId))
  if (!story) return []

  const settled = await Promise.allSettled(
    Array.from({ length: input.count }, () =>
      aiRunner.generateImage({
        model: ILLUSTRATION_MODEL,
        prompt: input.prompt,
        referenceImageUrls: [],
        storyId: input.storyId,
        stage: 'story_illustration_custom',
      }),
    ),
  )

  const uploaded: { storagePath: string }[] = []

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!
    if (result.status !== 'fulfilled') {
      console.error(`[custom-illustration] story ${input.storyId} — generation failed for image ${i}:`, result.reason)
      continue
    }
    try {
      const extension = mediaTypeToExtension(result.value.mediaType)
      const storagePath = buildStoryIllustrationAssetPath({ storyId: input.storyId, fileId: randomUUID(), extension })
      await storage.upload({ path: storagePath, data: Buffer.from(result.value.imageBase64, 'base64'), contentType: result.value.mediaType })
      uploaded.push({ storagePath })
    } catch (err) {
      console.error(`[custom-illustration] story ${input.storyId} — upload failed for image ${i}:`, err)
    }
  }

  if (uploaded.length === 0) return []

  const countRows = await db
    .select({ existingCustomCount: sqlCount() })
    .from(storyIllustrations)
    .where(and(eq(storyIllustrations.storyId, input.storyId), eq(storyIllustrations.source, 'custom')))
  const existingCustomCount = countRows[0]?.existingCustomCount ?? 0

  return db
    .insert(storyIllustrations)
    .values(
      uploaded.map((u, i) => ({
        storyId: input.storyId,
        storagePath: u.storagePath,
        momentDescription: input.prompt,
        source: 'custom' as const,
        characterIds: null,
        orderIndex: CUSTOM_ILLUSTRATION_ORDER_INDEX_BASE + existingCustomCount + i,
      })),
    )
    .returning()
}
