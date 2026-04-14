import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolvePrompt } from './prompt-resolver'
import { db } from '../db/client'

vi.mock('../db/client', () => {
  const chainable = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  }

  chainable.select.mockReturnValue(chainable)
  chainable.from.mockReturnValue(chainable)
  chainable.where.mockReturnValue(chainable)
  chainable.orderBy.mockReturnValue(chainable)
  chainable.limit.mockReturnValue([])

  return { db: chainable }
})

const mockedDb = db as unknown as {
  select: ReturnType<typeof vi.fn>
  from: ReturnType<typeof vi.fn>
  where: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
}

describe('resolvePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedDb.select.mockReturnValue(mockedDb)
    mockedDb.from.mockReturnValue(mockedDb)
    mockedDb.where.mockReturnValue(mockedDb)
    mockedDb.orderBy.mockReturnValue(mockedDb)
  })

  describe('when the prompts table has a row for the agent', () => {
    it('returns the DB text and version', async () => {
      mockedDb.limit.mockReturnValue([
        { agent: 'writer', text: 'Custom writer prompt', version: 3 },
      ])

      const result = await resolvePrompt('writer', 'DEFAULT')

      expect(result).toEqual({ text: 'Custom writer prompt', version: 3 })
    })
  })

  describe('when the prompts table has no row for the agent', () => {
    it('falls back to the default text and default version 1', async () => {
      mockedDb.limit.mockReturnValue([])

      const result = await resolvePrompt('writer', 'DEFAULT')

      expect(result).toEqual({ text: 'DEFAULT', version: 1 })
    })

    it('honors a custom fallback version when provided', async () => {
      mockedDb.limit.mockReturnValue([])

      const result = await resolvePrompt('plotter', 'DEFAULT', 7)

      expect(result).toEqual({ text: 'DEFAULT', version: 7 })
    })
  })

  describe('when the DB row has empty text', () => {
    it('treats the row as missing and returns the fallback', async () => {
      mockedDb.limit.mockReturnValue([{ agent: 'writer', text: '', version: 2 }])

      const result = await resolvePrompt('writer', 'DEFAULT')

      expect(result).toEqual({ text: 'DEFAULT', version: 1 })
    })
  })

  describe('when the DB lookup throws an error', () => {
    it('returns the fallback instead of propagating', async () => {
      mockedDb.limit.mockImplementation(() => {
        throw new Error('db unreachable')
      })

      const result = await resolvePrompt('writer', 'DEFAULT')

      expect(result).toEqual({ text: 'DEFAULT', version: 1 })
    })
  })
})
