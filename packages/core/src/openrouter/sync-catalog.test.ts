import { describe, it, expect, vi } from 'vitest'

const upsertCalls: unknown[] = []
const updateCalls: { soft: string[][]; undelete: string[][] } = { soft: [], undelete: [] }
const currentRows: Array<{ id: string; deletedAt: Date | null }> = []

vi.mock('../db/client.js', () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(async () => currentRows),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((v: unknown) => ({
          onConflictDoUpdate: vi.fn(async () => {
            upsertCalls.push(v)
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn((s: { deletedAt: Date | null }) => ({
          where: vi.fn(async (clause: unknown) => {
            const ids = (clause as { __ids?: string[] }).__ids ?? []
            if (s.deletedAt === null) updateCalls.undelete.push(ids)
            else updateCalls.soft.push(ids)
          }),
        })),
      })),
    },
  }
})

vi.mock('drizzle-orm', async (orig) => {
  const real = (await orig()) as Record<string, unknown>
  return {
    ...real,
    inArray: (_col: unknown, ids: string[]) => ({ __ids: ids }),
  }
})

vi.mock('../env.js', () => ({ env: { OPENROUTER_API_KEY: 'k' } }))

vi.mock('./openrouter-catalog-fetcher.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./openrouter-catalog-fetcher')>()
  return { ...actual, fetchOpenRouterCatalog: vi.fn() }
})

import { syncOpenRouterCatalog } from './sync-catalog'
import { parseOpenRouterModels } from './openrouter-catalog-fetcher'
import { fetchOpenRouterCatalog } from './openrouter-catalog-fetcher'

describe('parseOpenRouterModels', () => {
  it('converts per-token pricing to per-million USD', () => {
    const out = parseOpenRouterModels({
      data: [
        {
          id: 'a/b',
          name: 'A B',
          context_length: 2048,
          pricing: { prompt: '0.0000015', completion: '0.000002' },
          supported_features: ['structured_outputs'],
        },
      ],
    })

    expect(out).toHaveLength(1)
    expect(out[0]?.inputUsdPerMillion).toBeCloseTo(1.5, 5)
    expect(out[0]?.outputUsdPerMillion).toBeCloseTo(2, 5)
    expect(out[0]?.supportsJsonSchema).toBe(true)
    expect(out[0]?.isFree).toBe(false)
  })

  it('marks isFree when both prices are zero', () => {
    const out = parseOpenRouterModels({
      data: [{ id: 'free/x', name: 'Free', pricing: { prompt: '0', completion: '0' } }],
    })

    expect(out[0]?.isFree).toBe(true)
    expect(out[0]?.supportsJsonSchema).toBe(false)
  })
})

describe('syncOpenRouterCatalog', () => {
  it('upserts upstream, soft-deletes missing, undeletes returning', async () => {
    upsertCalls.length = 0
    updateCalls.soft = []
    updateCalls.undelete = []
    currentRows.length = 0
    currentRows.push(
      { id: 'old/gone', deletedAt: null },
      { id: 'returning', deletedAt: new Date() },
    )

    vi.mocked(fetchOpenRouterCatalog).mockResolvedValue(
      parseOpenRouterModels({
        data: [
          { id: 'returning', name: 'R', pricing: { prompt: '0', completion: '0' } },
          { id: 'new/x', name: 'X', pricing: { prompt: '0', completion: '0' }, supported_features: ['structured_outputs'] },
        ],
      }),
    )

    const result = await syncOpenRouterCatalog()

    expect(result).toEqual({ fetched: 2, upserted: 2, softDeleted: 1, undeleted: 1 })
    expect(updateCalls.soft).toEqual([['old/gone']])
    expect(updateCalls.undelete).toEqual([['returning']])
    expect(upsertCalls).toHaveLength(2)
  })
})
