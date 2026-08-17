import { describe, expect, it, vi, beforeEach } from 'vitest'
import { loadRandomExemplars } from './load-exemplars'

interface Row {
  title: string
  textFinal: string | null
}

let mockRowsQueue: Row[][] = []
let callIndex = 0

vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => mockRowsQueue[callIndex++] ?? []),
          })),
        })),
      })),
    })),
  },
}))

describe('loadRandomExemplars', () => {
  beforeEach(() => {
    mockRowsQueue = []
    callIndex = 0
  })

  describe('no universe selected', () => {
    it('draws count rows from the global pool', async () => {
      mockRowsQueue = [[{ title: 'A', textFinal: 'text A' }]]

      const result = await loadRandomExemplars([], 2)

      expect(result).toEqual([{ title: 'A', textFinal: 'text A' }])
    })
  })

  describe('a single universe selected', () => {
    it('draws count rows scoped to that universe', async () => {
      mockRowsQueue = [[
        { title: 'A', textFinal: 'text A' },
        { title: 'B', textFinal: 'text B' },
      ]]

      const result = await loadRandomExemplars([1], 2)

      expect(result).toEqual([
        { title: 'A', textFinal: 'text A' },
        { title: 'B', textFinal: 'text B' },
      ])
    })

    it('falls back to the global pool when the universe has no eligible stories', async () => {
      mockRowsQueue = [[], [{ title: 'Global', textFinal: 'text' }]]

      const result = await loadRandomExemplars([1], 2)

      expect(result).toEqual([{ title: 'Global', textFinal: 'text' }])
    })

    it('drops rows with a null textFinal', async () => {
      mockRowsQueue = [[{ title: 'A', textFinal: null }]]

      const result = await loadRandomExemplars([1], 2)

      expect(result).toEqual([])
    })
  })

  describe('multiple universes mixed', () => {
    it('draws exactly one exemplar from each selected universe', async () => {
      mockRowsQueue = [
        [{ title: 'From universe 1', textFinal: 'text 1' }],
        [{ title: 'From universe 2', textFinal: 'text 2' }],
      ]

      const result = await loadRandomExemplars([1, 2], 2)

      expect(result).toEqual([
        { title: 'From universe 1', textFinal: 'text 1' },
        { title: 'From universe 2', textFinal: 'text 2' },
      ])
    })

    it('caps at 4 exemplars even when more universes are selected', async () => {
      mockRowsQueue = [
        [{ title: 'U1', textFinal: 't1' }],
        [{ title: 'U2', textFinal: 't2' }],
        [{ title: 'U3', textFinal: 't3' }],
        [{ title: 'U4', textFinal: 't4' }],
        [{ title: 'U5', textFinal: 't5' }],
      ]

      const result = await loadRandomExemplars([1, 2, 3, 4, 5], 2)

      expect(result).toHaveLength(4)
      expect(result.map((e) => e.title)).toEqual(['U1', 'U2', 'U3', 'U4'])
    })

    it('does not backfill from other universes when one universe has no eligible stories', async () => {
      mockRowsQueue = [
        [{ title: 'From universe 1', textFinal: 'text 1' }],
        [],
      ]

      const result = await loadRandomExemplars([1, 2], 2)

      expect(result).toEqual([{ title: 'From universe 1', textFinal: 'text 1' }])
    })
  })
})
