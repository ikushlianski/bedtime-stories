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

import router from './story-illustrations'
import { generateIllustrationAlbum } from '@bedtime/core/story-illustrations/generate-illustration-album'

interface FakeReq {
  params: Record<string, string>
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

function getHandler(method: string, path: string): (req: FakeReq, res: FakeRes) => Promise<void> {
  const stack = (
    router as unknown as {
      stack: Array<{ route?: { path: string; stack: Array<{ method?: string; handle: unknown }> } }>
    }
  ).stack
  const layer = stack.find((l) => l.route?.path === path && l.route.stack.some((s) => s.method === method))

  if (!layer?.route) throw new Error(`route not found for ${method} ${path}`)

  const handlers = layer.route.stack.filter((s) => s.method === method)
  return handlers[handlers.length - 1]!.handle as (req: FakeReq, res: FakeRes) => Promise<void>
}

describe('story-illustrations routes', () => {
  beforeEach(() => {
    selectQueue = []
    selectCallIndex = 0
    vi.mocked(generateIllustrationAlbum).mockReset()
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
})
