import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { stories, storyEmbeddings } from '../db/schema.js'
import { env } from '../env.js'
import { OpenRouterClient } from '../openrouter/openrouter.client.js'
import { EMBEDDING_MODEL } from './embed-story.js'

const EXCERPT_LENGTH = 280

export interface StoryEmbeddingSearchRow {
  storyId: number
  storyTitle: string | null
  text: string
  distance: number
}

export interface SearchStoriesByEmbeddingOptions {
  universeId: number
  excludeStoryId?: number
  query: string
  limit: number
}

export async function searchStoriesByEmbedding(
  options: SearchStoriesByEmbeddingOptions,
  client: OpenRouterClient = new OpenRouterClient(env.OPENROUTER_API_KEY),
): Promise<StoryEmbeddingSearchRow[]> {
  const { embeddings } = await client.embed([options.query], EMBEDDING_MODEL)
  const queryVector = embeddings[0]

  if (queryVector === undefined) {
    throw new Error('embed() returned no vector for the search query')
  }

  const queryVectorLiteral = JSON.stringify(queryVector)
  const distanceExpr = sql<number>`${storyEmbeddings.embedding} <=> ${queryVectorLiteral}::vector`

  const conditions = [
    eq(storyEmbeddings.universeId, options.universeId),
    ...(options.excludeStoryId !== undefined ? [ne(storyEmbeddings.storyId, options.excludeStoryId)] : []),
  ]

  return db
    .select({
      storyId: storyEmbeddings.storyId,
      storyTitle: stories.title,
      text: sql<string>`coalesce(${stories.textFinal}, ${stories.textV2}, ${stories.textV1})`,
      distance: distanceExpr,
    })
    .from(storyEmbeddings)
    .innerJoin(stories, eq(storyEmbeddings.storyId, stories.id))
    .where(and(...conditions))
    .orderBy(distanceExpr)
    .limit(options.limit)
}

export interface StorySearchApiResult {
  storyId: number
  title: string
  similarity: number
  excerpt: string
}

export function deriveStorySearchApiResults(rows: StoryEmbeddingSearchRow[]): StorySearchApiResult[] {
  return rows.map((row) => ({
    storyId: row.storyId,
    title: row.storyTitle ?? 'Без названия',
    similarity: Math.max(0, 1 - row.distance),
    excerpt: row.text.length > EXCERPT_LENGTH ? `${row.text.slice(0, EXCERPT_LENGTH).trim()}…` : row.text,
  }))
}
