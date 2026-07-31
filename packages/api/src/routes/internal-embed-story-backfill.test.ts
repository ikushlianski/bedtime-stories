import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@bedtime/core/db/client'
import { embedStoriesBatch } from '@bedtime/core/pipeline/embed-story'
import { runEmbedStoryBackfill } from './internal-embed-story-backfill'

vi.mock('@bedtime/core/db/client', () => {
  const chainable = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
  }

  chainable.select.mockReturnValue(chainable)
  chainable.from.mockReturnValue(chainable)
  chainable.where.mockReturnValue(chainable)

  return { db: chainable }
})

vi.mock('@bedtime/core/pipeline/embed-story', () => ({
  embedStoriesBatch: vi.fn(),
}))

const mockedDb = db as unknown as {
  select: ReturnType<typeof vi.fn>
  from: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
}

describe('runEmbedStoryBackfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedDb.select.mockReturnValue(mockedDb)
    mockedDb.from.mockReturnValue(mockedDb)
  })

  it('embeds every story with status = read and reports the batch result', async () => {
    mockedDb.where.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])
    vi.mocked(embedStoriesBatch).mockResolvedValueOnce({
      embedded: [1, 2],
      skipped: [{ storyId: 3, reason: 'no usable text' }],
      failed: [],
    })

    const result = await runEmbedStoryBackfill()

    expect(embedStoriesBatch).toHaveBeenCalledWith([1, 2, 3])
    expect(result.embedded).toEqual([1, 2])
    expect(result.skipped).toEqual([{ storyId: 3, reason: 'no usable text' }])
  })

  it('is a no-op count when every read story is already embedded with a matching hash', async () => {
    mockedDb.where.mockResolvedValueOnce([{ id: 1 }])
    vi.mocked(embedStoriesBatch).mockResolvedValueOnce({ embedded: [], skipped: [], failed: [] })

    const result = await runEmbedStoryBackfill()

    expect(result.embedded).toHaveLength(0)
  })

  it('reports per-story failures without throwing', async () => {
    mockedDb.where.mockResolvedValueOnce([{ id: 5 }])
    vi.mocked(embedStoriesBatch).mockResolvedValueOnce({
      embedded: [],
      skipped: [],
      failed: [{ storyId: 5, reason: 'OpenRouter timeout' }],
    })

    const result = await runEmbedStoryBackfill()

    expect(result.failed).toEqual([{ storyId: 5, reason: 'OpenRouter timeout' }])
  })
})
