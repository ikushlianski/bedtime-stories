import { describe, it, expect, beforeEach, vi } from 'vitest'

let selectQueue: unknown[][] = []
let selectCallIndex = 0

function makeSelectBuilder(rows: unknown[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    then: (resolve: (rows: unknown[]) => void) => resolve(rows),
  }
  return builder
}

vi.mock('@bedtime/core/db/client', () => ({
  db: { select: vi.fn(() => makeSelectBuilder(selectQueue[selectCallIndex++] ?? [])) },
}))

vi.mock('@bedtime/core/env', () => ({ env: { GCS_BUCKET_NAME: 'bedtime-prod-storage' } }))

vi.mock('@bedtime/core/story-illustrations/generate-illustration-album', () => ({
  generateIllustrationAlbum: vi.fn(),
}))

vi.mock('@bedtime/core/story-illustrations/generate-custom-illustrations', () => ({
  generateCustomIllustrations: vi.fn(),
  DEFAULT_CUSTOM_ILLUSTRATION_COUNT: 2,
  MAX_CUSTOM_ILLUSTRATION_COUNT: 6,
}))

import router from './story-illustrations'
import { generateIllustrationAlbum } from '@bedtime/core/story-illustrations/generate-illustration-album'
import { generateCustomIllustrations } from '@bedtime/core/story-illustrations/generate-custom-illustrations'

interface FakeReq {
  params: Record<string, string>
  body?: unknown
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
    status(c: number) {
      res.statusCode = c
      return res
    },
    json(b: unknown) {
      res.body = b
      return res
    },
  }
  return res
}

type RouteHandler = (req: FakeReq, res: FakeRes, next: () => void) => unknown

function getRouteHandlers(method: string, path: string): RouteHandler[] {
  const stack = (
    router as unknown as {
      stack: Array<{ route?: { path: string; stack: Array<{ method?: string; handle: RouteHandler }> } }>
    }
  ).stack
  const layer = stack.find((l) => l.route?.path === path && l.route.stack.some((s) => s.method === method))

  if (!layer?.route) throw new Error(`route not found for ${method} ${path}`)

  return layer.route.stack.filter((s) => s.method === method).map((s) => s.handle)
}

function getHandler(method: string, path: string): (req: FakeReq, res: FakeRes) => Promise<void> {
  const handlers = getRouteHandlers(method, path)
  return handlers[handlers.length - 1] as (req: FakeReq, res: FakeRes) => Promise<void>
}

async function runRoute(method: string, path: string, req: FakeReq, res: FakeRes): Promise<void> {
  for (const handler of getRouteHandlers(method, path)) {
    let calledNext = false
    await handler(req, res, () => {
      calledNext = true
    })
    if (!calledNext) return
  }
}

describe('story-illustrations routes', () => {
  beforeEach(() => {
    selectQueue = []
    selectCallIndex = 0
    vi.mocked(generateIllustrationAlbum).mockReset()
    vi.mocked(generateCustomIllustrations).mockReset()
  })

  it('lists illustrations for a story as clickable, ordered thumbnails with public URLs', async () => {
    selectQueue = [
      [
        { id: 1, storyId: 5, storagePath: 'illustrations/5/a.png', momentDescription: 'сцена 1', source: 'automatic', orderIndex: 0 },
        { id: 2, storyId: 5, storagePath: 'illustrations/5/b.png', momentDescription: 'сцена 2', source: 'manual', orderIndex: 1 },
      ],
    ]
    const handler = getHandler('get', '/:id/illustrations')
    const req: FakeReq = { params: { id: '5' } }
    const res = makeRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const body = res.body as Array<{ imageUrl: string; orderIndex: number }>
    expect(body).toHaveLength(2)
    expect(body[0]?.imageUrl).toBe('https://storage.googleapis.com/bedtime-prod-storage/illustrations/5/a.png')
    expect(body[0]?.orderIndex).toBe(0)
  })

  it('regenerates the album, forcing a fresh run', async () => {
    vi.mocked(generateIllustrationAlbum).mockResolvedValueOnce([
      { id: 3, storyId: 5, storagePath: 'illustrations/5/c.png', momentDescription: 'сцена новая', source: 'automatic', orderIndex: 0, generatedAt: new Date(), characterIds: null },
    ])
    const handler = getHandler('post', '/:id/illustrations/regenerate')
    const req: FakeReq = { params: { id: '5' } }
    const res = makeRes()

    await handler(req, res)

    expect(generateIllustrationAlbum).toHaveBeenCalledWith(5, expect.anything(), { force: true })
    expect(res.statusCode).toBe(201)
    expect(res.body).toHaveLength(1)
  })

  it('generates custom illustrations from a hand-typed prompt and count', async () => {
    vi.mocked(generateCustomIllustrations).mockResolvedValueOnce([
      { id: 4, storyId: 5, storagePath: 'illustrations/5/d.png', momentDescription: 'A fox reading', source: 'custom', orderIndex: 1000, generatedAt: new Date(), characterIds: null },
    ])
    const req: FakeReq = { params: { id: '5' }, body: { prompt: 'A fox reading', count: 1 } }
    const res = makeRes()

    await runRoute('post', '/:id/illustrations/custom', req, res)

    expect(generateCustomIllustrations).toHaveBeenCalledWith({ storyId: 5, prompt: 'A fox reading', count: 1 }, expect.anything())
    expect(res.statusCode).toBe(201)
    const body = res.body as Array<{ source: string; orderIndex: number }>
    expect(body).toHaveLength(1)
    expect(body[0]?.source).toBe('custom')
    expect(body[0]?.orderIndex).toBe(1000)
  })

  it('defaults count to 2 when omitted', async () => {
    vi.mocked(generateCustomIllustrations).mockResolvedValueOnce([])
    const req: FakeReq = { params: { id: '5' }, body: { prompt: 'A fox reading' } }
    const res = makeRes()

    await runRoute('post', '/:id/illustrations/custom', req, res)

    expect(generateCustomIllustrations).toHaveBeenCalledWith({ storyId: 5, prompt: 'A fox reading', count: 2 }, expect.anything())
  })

  it('rejects a count above the cap before ever invoking generation', async () => {
    const req: FakeReq = { params: { id: '5' }, body: { prompt: 'A fox reading', count: 7 } }
    const res = makeRes()

    await runRoute('post', '/:id/illustrations/custom', req, res)

    expect(res.statusCode).toBe(400)
    expect(generateCustomIllustrations).not.toHaveBeenCalled()
  })

  it('rejects a count of 0 before ever invoking generation', async () => {
    const req: FakeReq = { params: { id: '5' }, body: { prompt: 'A fox reading', count: 0 } }
    const res = makeRes()

    await runRoute('post', '/:id/illustrations/custom', req, res)

    expect(res.statusCode).toBe(400)
    expect(generateCustomIllustrations).not.toHaveBeenCalled()
  })

  it('rejects a negative count before ever invoking generation', async () => {
    const req: FakeReq = { params: { id: '5' }, body: { prompt: 'A fox reading', count: -1 } }
    const res = makeRes()

    await runRoute('post', '/:id/illustrations/custom', req, res)

    expect(res.statusCode).toBe(400)
    expect(generateCustomIllustrations).not.toHaveBeenCalled()
  })

  it('rejects an empty prompt before ever invoking generation', async () => {
    const req: FakeReq = { params: { id: '5' }, body: { prompt: '' } }
    const res = makeRes()

    await runRoute('post', '/:id/illustrations/custom', req, res)

    expect(res.statusCode).toBe(400)
    expect(generateCustomIllustrations).not.toHaveBeenCalled()
  })

  it('rejects a prompt over 4000 characters before ever invoking generation', async () => {
    const req: FakeReq = { params: { id: '5' }, body: { prompt: 'x'.repeat(4001) } }
    const res = makeRes()

    await runRoute('post', '/:id/illustrations/custom', req, res)

    expect(res.statusCode).toBe(400)
    expect(generateCustomIllustrations).not.toHaveBeenCalled()
  })

  it('returns an empty array with 201 when the story does not exist, matching the established silent-empty convention', async () => {
    vi.mocked(generateCustomIllustrations).mockResolvedValueOnce([])
    const req: FakeReq = { params: { id: '999' }, body: { prompt: 'A fox reading' } }
    const res = makeRes()

    await runRoute('post', '/:id/illustrations/custom', req, res)

    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual([])
  })
})
