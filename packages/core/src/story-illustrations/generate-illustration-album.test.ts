import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ObjectStorage } from '../storage/object-storage.interface'

let selectQueue: unknown[][] = []
let selectCallIndex = 0
let insertedValues: unknown[] = []
let insertReturnRows: unknown[] = []
let deleteCalls: unknown[] = []
let operationsOrder: string[] = []

function makeSelectBuilder(rows: unknown[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    then: (resolve: (rows: unknown[]) => void) => resolve(rows),
  }
  return builder
}

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(() => makeSelectBuilder(selectQueue[selectCallIndex++] ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertedValues.push(values)
        operationsOrder.push('insert')
        return { returning: vi.fn(async () => insertReturnRows) }
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async (cond: unknown) => {
        deleteCalls.push(cond)
        operationsOrder.push('delete')
      }),
    })),
  },
}))

vi.mock('../env.js', () => ({ env: { GCS_BUCKET_NAME: 'bedtime-prod-storage' } }))
vi.mock('../ai/index.js', () => ({ aiRunner: { generateImage: vi.fn() } }))
vi.mock('../pipeline/assets/load-default-style-image.js', () => ({
  loadDefaultStyleImageDataUri: vi.fn(async () => 'data:image/png;base64,ZGVmYXVsdA=='),
}))
vi.mock('../pipeline/stages/select-illustration-moments.js', () => ({ selectIllustrationMoments: vi.fn() }))
vi.mock('./load-story-cast.js', () => ({ loadStoryCast: vi.fn() }))

import { generateIllustrationAlbum, ILLUSTRATION_MODEL } from './generate-illustration-album'
import { aiRunner } from '../ai/index.js'
import { selectIllustrationMoments } from '../pipeline/stages/select-illustration-moments.js'
import { loadStoryCast } from './load-story-cast.js'

function makeStorage(): ObjectStorage & { uploadCalls: unknown[] } {
  const uploadCalls: unknown[] = []
  return {
    uploadCalls,
    upload: vi.fn(async (input) => {
      uploadCalls.push(input)
    }),
    getSignedReadUrl: vi.fn(async (path: string) => `https://signed.example.com/${path}`),
    delete: vi.fn(async () => {}),
  }
}

const storyWithText = {
  id: 1,
  groupId: 10,
  textFinal: 'Полный текст истории про Гошу.',
  textV2: null,
  textV1: null,
}

const storyWithoutText = { id: 2, groupId: 10, textFinal: null, textV2: null, textV1: null }

const gosha = {
  id: 1,
  name: 'Гоша',
  description: 'Любопытный лисёнок',
  age: '7',
  traits: 'смелый',
  currentPortrait: null,
}

describe('generateIllustrationAlbum', () => {
  beforeEach(() => {
    selectQueue = []
    selectCallIndex = 0
    insertedValues = []
    insertReturnRows = []
    deleteCalls = []
    operationsOrder = []
    vi.mocked(aiRunner.generateImage).mockReset()
    vi.mocked(selectIllustrationMoments).mockReset()
    vi.mocked(loadStoryCast).mockReset()
  })

  it('returns nothing and makes no AI calls when the story has no usable text yet (Scenario 15)', async () => {
    selectQueue = [[storyWithoutText]]
    const storage = makeStorage()

    const result = await generateIllustrationAlbum(2, storage)

    expect(result).toEqual([])
    expect(loadStoryCast).not.toHaveBeenCalled()
    expect(selectIllustrationMoments).not.toHaveBeenCalled()
    expect(aiRunner.generateImage).not.toHaveBeenCalled()
  })

  it('skips entirely and makes no calls when an album already exists (Scenario 3)', async () => {
    const existingRow = { id: 99, storyId: 1, storagePath: 'illustrations/1/x.png', orderIndex: 0 }
    selectQueue = [[storyWithText], [existingRow]]
    const storage = makeStorage()

    const result = await generateIllustrationAlbum(1, storage)

    expect(result).toEqual([existingRow])
    expect(loadStoryCast).not.toHaveBeenCalled()
    expect(selectIllustrationMoments).not.toHaveBeenCalled()
    expect(aiRunner.generateImage).not.toHaveBeenCalled()
  })

  it('asks the automatic selector for exactly 2 moments when there are no marks', async () => {
    selectQueue = [[storyWithText], [], []]
    vi.mocked(loadStoryCast).mockResolvedValueOnce([])
    vi.mocked(selectIllustrationMoments).mockResolvedValueOnce({ moments: [] })
    const storage = makeStorage()

    await generateIllustrationAlbum(1, storage)

    expect(selectIllustrationMoments).toHaveBeenCalledWith(expect.objectContaining({ count: 2 }))
  })

  it('asks the automatic selector for exactly 1 remaining moment and passes the mark as avoid-duplication context', async () => {
    const marker = { id: 1, storyId: 1, markedText: 'Отмеченный отрывок истории', positionStart: 0, positionEnd: 10 }
    selectQueue = [[storyWithText], [], [marker]]
    vi.mocked(loadStoryCast).mockResolvedValueOnce([])
    vi.mocked(selectIllustrationMoments).mockResolvedValueOnce({ moments: [] })
    vi.mocked(aiRunner.generateImage).mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    insertReturnRows = [{ id: 1, storyId: 1, source: 'manual', orderIndex: 0 }]
    const storage = makeStorage()

    await generateIllustrationAlbum(1, storage)

    expect(selectIllustrationMoments).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1, alreadyMarkedTexts: ['Отмеченный отрывок истории'] }),
    )
  })

  it('never calls the automatic selector once marks alone reach the target of 2, but still illustrates both marks (Scenario 5)', async () => {
    const marker1 = { id: 1, storyId: 1, markedText: 'Первый отмеченный отрывок', positionStart: 0, positionEnd: 10 }
    const marker2 = { id: 2, storyId: 1, markedText: 'Второй отмеченный отрывок', positionStart: 20, positionEnd: 30 }
    selectQueue = [[storyWithText], [], [marker1, marker2]]
    vi.mocked(loadStoryCast).mockResolvedValueOnce([])
    vi.mocked(aiRunner.generateImage).mockResolvedValue({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    insertReturnRows = [
      { id: 1, storyId: 1, source: 'manual', orderIndex: 0 },
      { id: 2, storyId: 1, source: 'manual', orderIndex: 1 },
    ]
    const storage = makeStorage()

    const result = await generateIllustrationAlbum(1, storage)

    expect(selectIllustrationMoments).not.toHaveBeenCalled()
    expect(aiRunner.generateImage).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(2)

    const insertedBatch = insertedValues[0] as Array<{ source: string; momentDescription: string }>
    expect(insertedBatch.every((row) => row.source === 'manual')).toBe(true)
    expect(insertedBatch.map((r) => r.momentDescription)).toEqual([
      'Первый отмеченный отрывок',
      'Второй отмеченный отрывок',
    ])
  })

  it('still illustrates existing manual moments when the automatic selector call itself fails (Scenario 9 / automatic failure)', async () => {
    const marker = { id: 1, storyId: 1, markedText: 'Отмеченный отрывок', positionStart: 0, positionEnd: 10 }
    selectQueue = [[storyWithText], [], [marker]]
    vi.mocked(loadStoryCast).mockResolvedValueOnce([])
    vi.mocked(selectIllustrationMoments).mockRejectedValueOnce(new Error('selector exploded'))
    vi.mocked(aiRunner.generateImage).mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    insertReturnRows = [{ id: 1, storyId: 1, source: 'manual', orderIndex: 0 }]
    const storage = makeStorage()

    const result = await generateIllustrationAlbum(1, storage)

    expect(aiRunner.generateImage).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
  })

  it('keeps successful illustrations and drops failed ones without throwing (Scenario 9)', async () => {
    selectQueue = [[storyWithText], [], []]
    vi.mocked(loadStoryCast).mockResolvedValueOnce([])
    vi.mocked(selectIllustrationMoments).mockResolvedValueOnce({
      moments: [
        { scene_description: 'сцена 1', character_names: [] },
        { scene_description: 'сцена 2', character_names: [] },
      ],
    })
    vi.mocked(aiRunner.generateImage)
      .mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
      .mockRejectedValueOnce(new Error('rate limited'))
    insertReturnRows = [{ id: 1, storyId: 1, source: 'automatic', orderIndex: 0 }]
    const storage = makeStorage()

    const result = await generateIllustrationAlbum(1, storage)

    expect(result).toHaveLength(1)
    const insertedBatch = insertedValues[0] as unknown[]
    expect(insertedBatch).toHaveLength(1)
  })

  it('uses an already-generated character portrait as an identity reference, capped at 3, with the default style image always last', async () => {
    selectQueue = [[storyWithText], [], []]
    vi.mocked(loadStoryCast).mockResolvedValueOnce([
      { ...gosha, currentPortrait: { storagePath: 'portraits/1/a.png', tier: 'own_reference', generatedAt: new Date() } },
    ])
    vi.mocked(selectIllustrationMoments).mockResolvedValueOnce({
      moments: [{ scene_description: 'Гоша у реки', character_names: ['Гоша'] }],
    })
    vi.mocked(aiRunner.generateImage).mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    insertReturnRows = [{ id: 1, storyId: 1, source: 'automatic', orderIndex: 0 }]
    const storage = makeStorage()

    await generateIllustrationAlbum(1, storage)

    const call = vi.mocked(aiRunner.generateImage).mock.calls[0]?.[0]
    expect(call?.model).toBe(ILLUSTRATION_MODEL)
    expect(call?.storyId).toBe(1)
    expect(call?.stage).toBe('story_illustration')
    expect(call?.referenceImageUrls).toEqual([
      'https://storage.googleapis.com/bedtime-prod-storage/portraits/1/a.png',
      'data:image/png;base64,ZGVmYXVsdA==',
    ])
  })

  it('deletes prior rows before inserting the fresh set when force is set (Scenario 12)', async () => {
    const marker = { id: 1, storyId: 1, markedText: 'Отмеченный отрывок', positionStart: 0, positionEnd: 10 }
    selectQueue = [[storyWithText], [marker]]
    vi.mocked(loadStoryCast).mockResolvedValueOnce([])
    vi.mocked(selectIllustrationMoments).mockResolvedValueOnce({ moments: [] })
    vi.mocked(aiRunner.generateImage).mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    insertReturnRows = [{ id: 5, storyId: 1, source: 'manual', orderIndex: 0 }]
    const storage = makeStorage()

    const result = await generateIllustrationAlbum(1, storage, { force: true })

    expect(deleteCalls).toHaveLength(1)
    expect(operationsOrder).toEqual(['delete', 'insert'])
    expect(result).toHaveLength(1)
  })

  it('force still re-runs generation even if a non-forced album already exists, never short-circuiting', async () => {
    const marker = { id: 1, storyId: 1, markedText: 'Отмеченный отрывок', positionStart: 0, positionEnd: 10 }
    selectQueue = [[storyWithText], [marker]]
    vi.mocked(loadStoryCast).mockResolvedValueOnce([])
    vi.mocked(selectIllustrationMoments).mockResolvedValueOnce({ moments: [] })
    vi.mocked(aiRunner.generateImage).mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    insertReturnRows = [{ id: 5, storyId: 1, source: 'manual', orderIndex: 0 }]
    const storage = makeStorage()

    await generateIllustrationAlbum(1, storage, { force: true })

    expect(aiRunner.generateImage).toHaveBeenCalledTimes(1)
  })
})
