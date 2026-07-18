import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@bedtime/core/db/client'
import { syncUniverseMemory } from '@bedtime/core/pipeline/synthesize-universe-memory'
import { Sentry } from '@bedtime/observability'
import { runUniverseMemorySyncBatch } from './internal-universe-memory-sync'

vi.mock('@bedtime/core/db/client', () => {
  const chainable = {
    select: vi.fn(),
    from: vi.fn(),
  }

  chainable.select.mockReturnValue(chainable)
  chainable.from.mockReturnValue(chainable)

  return { db: chainable }
})

vi.mock('@bedtime/core/pipeline/synthesize-universe-memory', () => ({
  syncUniverseMemory: vi.fn(),
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

describe('runUniverseMemorySyncBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedDb.select.mockReturnValue(mockedDb)
    mockedDb.from.mockReturnValue(mockedDb)
  })

  it('continues to the next universe and reports a failure when one universe throws', async () => {
    mockedDb.from.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }])

    vi.mocked(syncUniverseMemory).mockImplementation(async (universeId: number) => {
      if (universeId === 2) throw new Error('malformed LLM output')
      return { updated: true, memory: { works: 'a', doesntWork: 'b', techniques: 'c', minimize: 'd' } }
    })

    const result = await runUniverseMemorySyncBatch()

    expect(result).toEqual({ skipped: false, universesProcessed: 3, universesUpdated: 2, universesFailed: 1 })
    expect(syncUniverseMemory).toHaveBeenCalledTimes(3)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { universeId: '2' } })
  })

  it('skips a run that overlaps with one already in flight on this instance', async () => {
    mockedDb.from.mockResolvedValueOnce([{ id: 1 }])

    const gate = deferred<void>()
    vi.mocked(syncUniverseMemory).mockImplementation(async () => {
      await gate.promise
      return { updated: true, memory: { works: '', doesntWork: '', techniques: '', minimize: '' } }
    })

    const firstRun = runUniverseMemorySyncBatch()
    const secondRun = await runUniverseMemorySyncBatch()

    expect(secondRun).toEqual({ skipped: true, universesProcessed: 0, universesUpdated: 0, universesFailed: 0 })

    gate.resolve()
    const firstResult = await firstRun

    expect(firstResult.skipped).toBe(false)
    expect(firstResult.universesUpdated).toBe(1)
  })

  it('allows a fresh run once the previous batch has finished', async () => {
    mockedDb.from.mockResolvedValueOnce([{ id: 1 }])
    vi.mocked(syncUniverseMemory).mockResolvedValueOnce({ updated: false })
    await runUniverseMemorySyncBatch()

    mockedDb.from.mockResolvedValueOnce([{ id: 1 }])
    vi.mocked(syncUniverseMemory).mockResolvedValueOnce({ updated: true, memory: { works: '', doesntWork: '', techniques: '', minimize: '' } })
    const result = await runUniverseMemorySyncBatch()

    expect(result.skipped).toBe(false)
    expect(result.universesUpdated).toBe(1)
  })
})
