import { createHash } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { stories, storyEmbeddings } from '../db/schema.js'
import { env } from '../env.js'
import { OpenRouterClient } from '../openrouter/openrouter.client.js'

export const EMBEDDING_MODEL = 'openai/text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536
const EMBED_CHUNK_SIZE = 50

export interface EmbeddingInput {
  text: string
  contentHash: string
}

export interface StoryTextRow {
  textFinal: string | null
  textV2: string | null
  textV1: string | null
}

export function deriveEmbeddingInput(story: StoryTextRow): EmbeddingInput | null {
  const raw = story.textFinal ?? story.textV2 ?? story.textV1
  const text = raw?.trim() ?? ''

  if (text === '') {
    return null
  }

  const contentHash = createHash('sha256').update(text).digest('hex')

  return { text, contentHash }
}

export interface EmbedStoriesBatchResult {
  embedded: number[]
  skipped: Array<{ storyId: number; reason: string }>
  failed: Array<{ storyId: number; reason: string }>
}

export async function embedStoriesBatch(
  storyIds: number[],
  client: OpenRouterClient = new OpenRouterClient(env.OPENROUTER_API_KEY),
): Promise<EmbedStoriesBatchResult> {
  if (storyIds.length === 0) {
    return { embedded: [], skipped: [], failed: [] }
  }

  const rows = await db
    .select({
      id: stories.id,
      groupId: stories.groupId,
      textFinal: stories.textFinal,
      textV2: stories.textV2,
      textV1: stories.textV1,
    })
    .from(stories)
    .where(inArray(stories.id, storyIds))

  const existingRows = await db
    .select({ storyId: storyEmbeddings.storyId, contentHash: storyEmbeddings.contentHash })
    .from(storyEmbeddings)
    .where(inArray(storyEmbeddings.storyId, storyIds))

  const existingHashByStoryId = new Map(existingRows.map((row) => [row.storyId, row.contentHash]))

  const skipped: Array<{ storyId: number; reason: string }> = []
  const failed: Array<{ storyId: number; reason: string }> = []
  const candidates: Array<{ storyId: number; groupId: number | null; input: EmbeddingInput }> = []

  for (const row of rows) {
    const input = deriveEmbeddingInput(row)

    if (input === null) {
      skipped.push({ storyId: row.id, reason: 'no usable text' })
      continue
    }

    if (existingHashByStoryId.get(row.id) === input.contentHash) {
      continue
    }

    candidates.push({ storyId: row.id, groupId: row.groupId ?? null, input })
  }

  const embedded: number[] = []

  for (let i = 0; i < candidates.length; i += EMBED_CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + EMBED_CHUNK_SIZE)

    try {
      const { embeddings } = await client.embed(
        chunk.map((c) => c.input.text),
        EMBEDDING_MODEL,
      )

      if (embeddings.length !== chunk.length) {
        throw new Error(
          `embeddings response length ${embeddings.length} does not match request length ${chunk.length}`,
        )
      }

      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j]
        const vector = embeddings[j]

        if (item === undefined || vector === undefined) {
          continue
        }

        if (vector.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `embedding dimension mismatch for storyId=${item.storyId}: expected ${EMBEDDING_DIMENSIONS}, got ${vector.length}`,
          )
        }

        await db
          .insert(storyEmbeddings)
          .values({
            storyId: item.storyId,
            universeId: item.groupId,
            embedding: vector,
            contentHash: item.input.contentHash,
            embeddingModel: EMBEDDING_MODEL,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: storyEmbeddings.storyId,
            set: {
              universeId: item.groupId,
              embedding: vector,
              contentHash: item.input.contentHash,
              embeddingModel: EMBEDDING_MODEL,
              updatedAt: new Date(),
            },
          })

        embedded.push(item.storyId)
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)

      for (const item of chunk) {
        failed.push({ storyId: item.storyId, reason })
      }
    }
  }

  return { embedded, skipped, failed }
}

export async function embedStory(
  storyId: number,
  client?: OpenRouterClient,
): Promise<void> {
  const result = await embedStoriesBatch([storyId], client)
  const failure = result.failed.find((f) => f.storyId === storyId)

  if (failure !== undefined) {
    throw new Error(`embedStory(${storyId}) failed: ${failure.reason}`)
  }
}
