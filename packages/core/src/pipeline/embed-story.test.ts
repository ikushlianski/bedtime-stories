import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { deriveEmbeddingInput, embedStoriesBatch, EMBEDDING_DIMENSIONS } from './embed-story'
import type { OpenRouterClient } from '../openrouter/openrouter.client'

let mockStoryRows: Array<{
  id: number
  groupId: number | null
  textFinal: string | null
  textV2: string | null
  textV1: string | null
}> = []
let mockExistingRows: Array<{ storyId: number; contentHash: string | null }> = []

let selectCallCount = 0

vi.mock('../env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
    OPENROUTER_API_KEY: 'test-key',
    JWT_SECRET: 'x'.repeat(32),
  },
}))

vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(() => {
      selectCallCount += 1
      const isFirstCall = selectCallCount % 2 === 1

      return {
        from: vi.fn(() => ({
          where: vi.fn(async () => (isFirstCall ? mockStoryRows : mockExistingRows)),
        })),
      }
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(async () => undefined),
      })),
    })),
  },
}))

describe('deriveEmbeddingInput', () => {
  it('returns null when the story has no usable text', () => {
    const result = deriveEmbeddingInput({ textFinal: null, textV2: null, textV1: null })

    expect(result).toBeNull()
  })

  it('returns null when every text field is an empty or whitespace-only string', () => {
    const result = deriveEmbeddingInput({ textFinal: '   ', textV2: null, textV1: '' })

    expect(result).toBeNull()
  })

  it('prefers textFinal over textV2 and textV1', () => {
    const result = deriveEmbeddingInput({
      textFinal: 'финальный текст',
      textV2: 'вторая версия',
      textV1: 'первая версия',
    })

    expect(result).not.toBeNull()
    expect(result?.text).toBe('финальный текст')
  })

  it('falls back to textV2 when textFinal is missing', () => {
    const result = deriveEmbeddingInput({ textFinal: null, textV2: 'вторая версия', textV1: 'первая версия' })

    expect(result?.text).toBe('вторая версия')
  })

  it('falls back to textV1 when textFinal and textV2 are missing', () => {
    const result = deriveEmbeddingInput({ textFinal: null, textV2: null, textV1: 'первая версия' })

    expect(result?.text).toBe('первая версия')
  })

  it('produces a stable hash for identical text', () => {
    const a = deriveEmbeddingInput({ textFinal: 'один и тот же текст', textV2: null, textV1: null })
    const b = deriveEmbeddingInput({ textFinal: 'один и тот же текст', textV2: null, textV1: null })

    expect(a?.contentHash).toBe(b?.contentHash)
  })

  it('produces a different hash for different text', () => {
    const a = deriveEmbeddingInput({ textFinal: 'текст один', textV2: null, textV1: null })
    const b = deriveEmbeddingInput({ textFinal: 'текст два', textV2: null, textV1: null })

    expect(a?.contentHash).not.toBe(b?.contentHash)
  })

  it('hashes the trimmed text as a sha256 hex digest', () => {
    const result = deriveEmbeddingInput({ textFinal: '  текст с пробелами  ', textV2: null, textV1: null })
    const expectedHash = createHash('sha256').update('текст с пробелами').digest('hex')

    expect(result?.contentHash).toBe(expectedHash)
    expect(result?.text).toBe('текст с пробелами')
  })
})

describe('embedStoriesBatch dimension-mismatch safety net', () => {
  beforeEach(() => {
    selectCallCount = 0
    mockStoryRows = [
      { id: 1, groupId: 1, textFinal: 'текст истории', textV2: null, textV1: null },
    ]
    mockExistingRows = []
  })

  it('reports a story as failed, not embedded, when the response vector length does not match EMBEDDING_DIMENSIONS', async () => {
    const wrongLengthVector = new Array(EMBEDDING_DIMENSIONS - 1).fill(0)
    const fakeClient = {
      embed: vi.fn(async () => ({
        embeddings: [wrongLengthVector],
        usage: { promptTokens: 0, completionTokens: 0, costUsd: 0 },
      })),
    } as unknown as OpenRouterClient

    const result = await embedStoriesBatch([1], fakeClient)

    expect(result.embedded).toEqual([])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]?.storyId).toBe(1)
    expect(result.failed[0]?.reason).toContain(`expected ${EMBEDDING_DIMENSIONS}`)
    expect(result.failed[0]?.reason).toContain(`got ${wrongLengthVector.length}`)
  })

  it('embeds successfully when the response vector length matches EMBEDDING_DIMENSIONS', async () => {
    const correctLengthVector = new Array(EMBEDDING_DIMENSIONS).fill(0.1)
    const fakeClient = {
      embed: vi.fn(async () => ({
        embeddings: [correctLengthVector],
        usage: { promptTokens: 0, completionTokens: 0, costUsd: 0 },
      })),
    } as unknown as OpenRouterClient

    const result = await embedStoriesBatch([1], fakeClient)

    expect(result.failed).toEqual([])
    expect(result.embedded).toEqual([1])
  })
})
