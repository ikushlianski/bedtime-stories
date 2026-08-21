import { describe, it, expect, beforeEach, vi } from 'vitest'

let selectQueue: unknown[][] = []
let selectCallIndex = 0
let insertedRows: unknown[] = []
let insertReturnRow: unknown = null
let deleteCalls: unknown[] = []

function makeSelectBuilder(rows: unknown[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    then: (resolve: (rows: unknown[]) => void) => resolve(rows),
  }
  return builder
}

vi.mock('@bedtime/core/db/client', () => ({
  db: {
    select: vi.fn(() => makeSelectBuilder(selectQueue[selectCallIndex++] ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertedRows.push(values)
        return { returning: vi.fn(async () => [insertReturnRow]) }
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async (cond: unknown) => {
        deleteCalls.push(cond)
      }),
    })),
  },
}))

import router from './story-illustration-markers'

interface FakeReq {
  params: Record<string, string>
  body?: Record<string, unknown>
}

interface FakeRes {
  statusCode: number
  body: unknown
  status(code: number): FakeRes
  json(body: unknown): FakeRes
  send(body?: unknown): FakeRes
}

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 200,
    body: undefined,
    status(c: number) {
      res.statusCode = c
      return res
    },
    json(b: unknown) {
      res.body = b
      return res
    },
    send(b?: unknown) {
      res.body = b
      return res
    },
  }
  return res
}

function getHandler(method: string, path: string): (req: FakeReq, res: FakeRes) => Promise<void> {
  const stack = (
    router as unknown as {
      stack: Array<{ route?: { path: string; stack: Array<{ method?: string; handle: unknown }> } }>
    }
  ).stack
  const layer = stack.find(
    (l) => l.route?.path === path && l.route.stack.some((s) => s.method === method),
  )

  if (!layer?.route) throw new Error(`route not found for ${method} ${path}`)

  const handlers = layer.route.stack.filter((s) => s.method === method)
  return handlers[handlers.length - 1]!.handle as (req: FakeReq, res: FakeRes) => Promise<void>
}

describe('story-illustration-markers routes', () => {
  beforeEach(() => {
    selectQueue = []
    selectCallIndex = 0
    insertedRows = []
    insertReturnRow = { id: 1, storyId: 5, markedText: 'a passage', positionStart: 0, positionEnd: 9, createdAt: new Date() }
    deleteCalls = []
  })

  it('creates a marker when below the cap', async () => {
    selectQueue = [[]]
    const handler = getHandler('post', '/:id/illustration-markers')
    const req: FakeReq = { params: { id: '5' }, body: { text: 'a passage', position_start: 0, position_end: 9 } }
    const res = makeRes()

    await handler(req, res)

    expect(res.statusCode).toBe(201)
    expect(insertedRows[0]).toMatchObject({ storyId: 5, markedText: 'a passage', positionStart: 0, positionEnd: 9 })
  })

  it('rejects a new marker once the story is already at the cap, with a clear reason', async () => {
    selectQueue = [[{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }]]
    const handler = getHandler('post', '/:id/illustration-markers')
    const req: FakeReq = { params: { id: '5' }, body: { text: 'a passage', position_start: 0, position_end: 9 } }
    const res = makeRes()

    await handler(req, res)

    expect(res.statusCode).toBe(422)
    expect((res.body as { error?: string }).error).toBeTruthy()
    expect(insertedRows).toHaveLength(0)
  })

  it('lists current markers for a story', async () => {
    selectQueue = [[{ id: 1, storyId: 5, markedText: 'a passage', positionStart: 0, positionEnd: 9 }]]
    const handler = getHandler('get', '/:id/illustration-markers')
    const req: FakeReq = { params: { id: '5' } }
    const res = makeRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
  })

  it('deletes a marker by id, scoped to the story', async () => {
    const handler = getHandler('delete', '/:id/illustration-markers/:markerId')
    const req: FakeReq = { params: { id: '5', markerId: '1' } }
    const res = makeRes()

    await handler(req, res)

    expect(res.statusCode).toBe(204)
    expect(deleteCalls).toHaveLength(1)
  })
})
