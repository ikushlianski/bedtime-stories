import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@bedtime/core/db/client'
import { generateStoryIdeasForUniverse } from '@bedtime/core/pipeline/generate-story-ideas'
import { generateTopicCandidatesForUniverse } from '@bedtime/core/pipeline/generate-topic-candidates'
import { haveDailySuggestionsRunToday } from '@bedtime/core/pipeline/check-daily-suggestions-ran-today'
import { Sentry } from '@bedtime/observability'
import { runDailySuggestionsBatch } from './internal-daily-suggestions'

vi.mock('@bedtime/core/db/client', () => {
  const chainable = {
    select: vi.fn(),
    from: vi.fn(),
  }

  chainable.select.mockReturnValue(chainable)
  chainable.from.mockReturnValue(chainable)

  return { db: chainable }
})

vi.mock('@bedtime/core/pipeline/generate-story-ideas', () => ({
  generateStoryIdeasForUniverse: vi.fn(),
}))

vi.mock('@bedtime/core/pipeline/generate-topic-candidates', () => ({
  generateTopicCandidatesForUniverse: vi.fn(),
}))

vi.mock('@bedtime/core/pipeline/check-daily-suggestions-ran-today', () => ({
  haveDailySuggestionsRunToday: vi.fn(),
}))

vi.mock('@bedtime/observability', () => ({
  Sentry: { captureException: vi.fn() },
}))

const mockedDb = db as unknown as { select: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn> }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('runDailySuggestionsBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedDb.select.mockReturnValue(mockedDb)
    mockedDb.from.mockReturnValue(mockedDb)
    vi.mocked(haveDailySuggestionsRunToday).mockResolvedValue(false)
  })

  it('continues to the next universe and reports a failure when one universe throws', async () => {
    mockedDb.from.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])

    vi.mocked(generateStoryIdeasForUniverse).mockImplementation(async (universeId: number) => {
      if (universeId === 2) throw new Error('idea generation failed')
      return { ideaCount: 3, createdIds: [1, 2, 3] }
    })
    vi.mocked(generateTopicCandidatesForUniverse).mockResolvedValue({ createdCount: 2, createdIds: [10, 11] })

    const result = await runDailySuggestionsBatch()

    expect(result).toEqual({
      skipped: false,
      universesProcessed: 3,
      ideasCreated: 6,
      topicsCreated: 4,
      universesFailed: 1,
    })
    expect(generateStoryIdeasForUniverse).toHaveBeenCalledTimes(3)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { universeId: '2' } })
  })

  it('skips a run that overlaps with one already in flight on this instance', async () => {
    mockedDb.from.mockResolvedValueOnce([{ id: 1 }])

    const gate = deferred<void>()
    vi.mocked(generateStoryIdeasForUniverse).mockImplementation(async () => {
      await gate.promise
      return { ideaCount: 1, createdIds: [1] }
    })
    vi.mocked(generateTopicCandidatesForUniverse).mockResolvedValue({ createdCount: 0, createdIds: [] })

    const firstRun = runDailySuggestionsBatch()
    const secondRun = await runDailySuggestionsBatch()

    expect(secondRun).toEqual({
      skipped: true,
      skipReason: 'in-flight',
      universesProcessed: 0,
      ideasCreated: 0,
      topicsCreated: 0,
      universesFailed: 0,
    })

    gate.resolve()
    const firstResult = await firstRun

    expect(firstResult.skipped).toBe(false)
    expect(firstResult.ideasCreated).toBe(1)
  })

  it('skips the entire run when suggestions were already created today', async () => {
    vi.mocked(haveDailySuggestionsRunToday).mockResolvedValue(true)

    const result = await runDailySuggestionsBatch()

    expect(result).toEqual({
      skipped: true,
      skipReason: 'already-run-today',
      universesProcessed: 0,
      ideasCreated: 0,
      topicsCreated: 0,
      universesFailed: 0,
    })
    expect(generateStoryIdeasForUniverse).not.toHaveBeenCalled()
    expect(generateTopicCandidatesForUniverse).not.toHaveBeenCalled()
  })
})
