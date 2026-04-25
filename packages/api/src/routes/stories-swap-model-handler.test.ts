import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbState = {
  selectStoryRow: { id: 7, seed: 'a hero', planV1: 'p1', planFinal: 'pf', mode: 'auto' as const, groupId: null, agentOverrides: {} },
  selectSnapshotRow: { id: 99, plotterModel: 'old/plot', writerModel: 'old/write' } as Record<string, unknown>,
  selectGroupRow: null as null | Record<string, unknown>,
  insertedSwap: null as null | Record<string, unknown>,
  updatedSnapshotPatch: null as null | Record<string, unknown>,
  updatedStoryPatch: null as null | Record<string, unknown>,
}

function tableName(t: unknown): string {
  if (typeof t !== 'object' || t === null) return ''
  const sym = Object.getOwnPropertySymbols(t).find((s) => s.toString() === 'Symbol(drizzle:OriginalName)')
  return sym ? String((t as Record<symbol, unknown>)[sym]) : ''
}

vi.mock('@bedtime/core/db/client', () => {
  const limit1 = (rows: unknown[]) => Promise.resolve(rows)
  const select = vi.fn((_cols?: unknown) => {
    let table = ''
    return {
      from: vi.fn((tbl: unknown) => {
        table = tableName(tbl)
        return {
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              if (table === 'stories') return limit1([dbState.selectStoryRow])
              if (table === 'run_snapshots') return limit1([dbState.selectSnapshotRow])
              if (table === 'story_groups') return limit1(dbState.selectGroupRow ? [dbState.selectGroupRow] : [])
              return limit1([])
            }),
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => limit1([dbState.selectSnapshotRow])),
            })),
          })),
        }
      }),
    }
  })

  const tx = {
    insert: vi.fn(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        dbState.insertedSwap = v
        return Promise.resolve()
      }),
    })),
    update: vi.fn((tbl: unknown) => ({
      set: vi.fn((v: Record<string, unknown>) => {
        const n = tableName(tbl)
        if (n === 'run_snapshots') dbState.updatedSnapshotPatch = v
        else if (n === 'stories') dbState.updatedStoryPatch = v
        return { where: vi.fn(() => Promise.resolve()) }
      }),
    })),
  }

  const transaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx))

  return { db: { select, transaction } }
})

const planRedo = vi.fn()
const textPhase = vi.fn()
vi.mock('./pipeline-plan-redo', () => ({ triggerPlanRedo: (...a: unknown[]) => planRedo(...a) }))
vi.mock('./pipeline-text-trigger', () => ({ triggerTextPhase: (...a: unknown[]) => textPhase(...a) }))

import router from './stories-swap-model'

interface FakeReq {
  params: Record<string, string>
  body: Record<string, unknown>
}

interface FakeRes {
  statusCode: number
  body: unknown
  status(code: number): FakeRes
  json(body: unknown): FakeRes
}

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: undefined,
    status(c: number) { res.statusCode = c; return res },
    json(b: unknown) { res.body = b; return res },
  }
  return res
}

function getPostHandler(): (req: FakeReq, res: FakeRes) => Promise<void> {
  const layer = (router as unknown as { stack: Array<{ route?: { stack: Array<{ method?: string; handle: unknown }> } }> }).stack
    .find((l) => l.route)
  if (!layer || !layer.route) throw new Error('post handler not found')
  const postHandlers = layer.route.stack.filter((s) => s.method === 'post')
  return postHandlers[postHandlers.length - 1]!.handle as (req: FakeReq, res: FakeRes) => Promise<void>
}

describe('stories-swap-model handler', () => {
  beforeEach(() => {
    dbState.insertedSwap = null
    dbState.updatedSnapshotPatch = null
    dbState.updatedStoryPatch = null
    planRedo.mockReset()
    textPhase.mockReset()
  })

  it('writes model_swap_events row, sets story.agentOverrides, leaves prior run_snapshots untouched, dispatches plotter rerun', async () => {
    const handler = getPostHandler()
    const req: FakeReq = {
      params: { id: '7' },
      body: { stage: 'plotter', toModel: 'new/plot', reasonChip: 'boring_prose' },
    }
    const res = makeRes()
    await handler(req, res)

    expect(res.statusCode).toBe(201)
    expect(dbState.insertedSwap).toMatchObject({
      storyId: 7,
      stage: 'plotter',
      fromModel: 'old/plot',
      toModel: 'new/plot',
      reasonChip: 'boring_prose',
    })
    expect(dbState.updatedSnapshotPatch).toBeNull()
    expect(dbState.updatedStoryPatch?.['agentOverrides']).toEqual({
      plotter: { model: 'new/plot' },
    })

    await new Promise((r) => setImmediate(r))
    expect(planRedo).toHaveBeenCalledTimes(1)
    expect(textPhase).not.toHaveBeenCalled()
  })

  it('dispatches text phase rerun on writer swap without mutating snapshot provenance', async () => {
    const handler = getPostHandler()
    const req: FakeReq = {
      params: { id: '7' },
      body: { stage: 'writer', toModel: 'new/write', reasonText: 'too repetitive' },
    }
    const res = makeRes()
    await handler(req, res)

    expect(res.statusCode).toBe(201)
    expect(dbState.updatedSnapshotPatch).toBeNull()

    await new Promise((r) => setImmediate(r))
    expect(textPhase).toHaveBeenCalledTimes(1)
    expect(planRedo).not.toHaveBeenCalled()
  })
})
