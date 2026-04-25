import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  deriveAwaitingFeedbackInbox,
  type AwaitingInboxStoryRow,
} from '@bedtime/core/cost/aggregations/derive-awaiting-feedback-inbox'

const dbState = {
  storyExists: true as boolean,
  insertedRow: null as null | Record<string, unknown>,
}

vi.mock('@bedtime/core/db/client', () => {
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve(dbState.storyExists ? [{ id: 7 }] : [])),
      })),
    })),
  }))

  const insert = vi.fn(() => ({
    values: vi.fn((v: Record<string, unknown>) => ({
      onConflictDoUpdate: vi.fn(() => ({
        returning: vi.fn(() => {
          dbState.insertedRow = v
          return Promise.resolve([{ id: 1, ...v, createdAt: new Date('2026-04-25') }])
        }),
      })),
    })),
  }))

  return { db: { select, insert } }
})

import router from './stories-vfm'

interface FakeReq { params: Record<string, string>; body: Record<string, unknown> }
interface FakeRes { statusCode: number; body: unknown; status(c: number): FakeRes; json(b: unknown): FakeRes }

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200, body: undefined,
    status(c) { res.statusCode = c; return res },
    json(b) { res.body = b; return res },
  }
  return res
}

function getPostHandler(): (req: FakeReq, res: FakeRes) => Promise<void> {
  const layer = (router as unknown as { stack: Array<{ route?: { stack: Array<{ method?: string; handle: unknown }> } }> }).stack
    .find((l) => l.route)
  if (!layer || !layer.route) throw new Error('post handler not found')
  const handlers = layer.route.stack.filter((s) => s.method === 'post')
  return handlers[handlers.length - 1]!.handle as (req: FakeReq, res: FakeRes) => Promise<void>
}

describe('stories-vfm handler', () => {
  beforeEach(() => {
    dbState.insertedRow = null
    dbState.storyExists = true
  })

  it('persists row when rating provided without note', async () => {
    const handler = getPostHandler()
    const req: FakeReq = { params: { id: '7' }, body: { rating: 4 } }
    const res = makeRes()
    await handler(req, res)

    expect(res.statusCode).toBe(201)
    expect(dbState.insertedRow).toMatchObject({ storyId: 7, rating: 4, note: null })
  })

  it('persists row with note when both provided', async () => {
    const handler = getPostHandler()
    const req: FakeReq = { params: { id: '7' }, body: { rating: 5, note: 'worth it' } }
    const res = makeRes()
    await handler(req, res)

    expect(res.statusCode).toBe(201)
    expect(dbState.insertedRow).toMatchObject({ storyId: 7, rating: 5, note: 'worth it' })
  })

  it('story disappears from inbox query after vfm row exists', () => {
    const before: AwaitingInboxStoryRow[] = [
      { storyId: 7, title: 'A', status: 'read', readyAt: new Date(2000), hasFeedback: false },
      { storyId: 8, title: 'B', status: 'ready', readyAt: new Date(1000), hasFeedback: false },
    ]
    expect(deriveAwaitingFeedbackInbox(before).map((r) => r.storyId)).toEqual([7, 8])

    const after: AwaitingInboxStoryRow[] = before.map((r) =>
      r.storyId === 7 ? { ...r, hasFeedback: true } : r,
    )
    expect(deriveAwaitingFeedbackInbox(after).map((r) => r.storyId)).toEqual([8])
  })
})
