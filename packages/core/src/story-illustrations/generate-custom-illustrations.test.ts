import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ObjectStorage } from '../storage/object-storage.interface'

let selectQueue: unknown[][] = []
let selectCallIndex = 0
let insertedValues: unknown[] = []
let insertReturnRows: unknown[] = []

function makeSelectBuilder(rows: unknown[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
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
        return { returning: vi.fn(async () => insertReturnRows) }
      }),
    })),
  },
}))

vi.mock('../ai/index.js', () => ({ aiRunner: { generateImage: vi.fn() } }))
vi.mock('./generate-illustration-album.js', () => ({ ILLUSTRATION_MODEL: 'google/gemini-3.1-flash-image' }))
vi.mock('../pipeline/assets/load-default-style-image.js', () => ({
  loadDefaultStyleImageDataUri: vi.fn(async () => 'data:image/png;base64,ZGVmYXVsdA=='),
}))
vi.mock('./load-story-cast.js', () => ({ loadStoryCast: vi.fn() }))

import {
  generateCustomIllustrations,
  CUSTOM_ILLUSTRATION_ORDER_INDEX_BASE,
} from './generate-custom-illustrations'
import { aiRunner } from '../ai/index.js'
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

const existingStory = { id: 1 }

function image() {
  return { imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' }
}

describe('generateCustomIllustrations', () => {
  beforeEach(() => {
    selectQueue = []
    selectCallIndex = 0
    insertedValues = []
    insertReturnRows = []
    vi.mocked(aiRunner.generateImage).mockReset()
    vi.mocked(loadStoryCast).mockReset().mockResolvedValue([])
  })

  it('returns nothing and makes no AI calls when the story does not exist', async () => {
    selectQueue = [[]]
    const storage = makeStorage()

    const result = await generateCustomIllustrations({ storyId: 99, prompt: 'A fox reading', count: 2 }, storage)

    expect(result).toEqual([])
    expect(aiRunner.generateImage).not.toHaveBeenCalled()
  })

  it('generates exactly the requested count of images from the prompt, anchored to the default style reference image', async () => {
    selectQueue = [[existingStory], [{ existingCustomCount: 0 }]]
    vi.mocked(aiRunner.generateImage).mockResolvedValue(image())
    insertReturnRows = [
      { id: 1, storyId: 1, source: 'custom', orderIndex: 1000 },
      { id: 2, storyId: 1, source: 'custom', orderIndex: 1001 },
    ]
    const storage = makeStorage()

    const result = await generateCustomIllustrations(
      { storyId: 1, prompt: 'A fox reading a book under a blue moon', count: 2 },
      storage,
    )

    expect(aiRunner.generateImage).toHaveBeenCalledTimes(2)
    for (const call of vi.mocked(aiRunner.generateImage).mock.calls) {
      expect(call[0]).toMatchObject({
        referenceImageUrls: ['data:image/png;base64,ZGVmYXVsdA=='],
        stage: 'story_illustration_custom',
        storyId: 1,
      })
      const promptSent = (call[0] as { prompt: string }).prompt
      expect(promptSent).toContain('A fox reading a book under a blue moon')
      expect(promptSent).toMatch(/style anchor/i)
    }
    expect(result).toHaveLength(2)
  })

  it('generates a custom count of images and assigns sequential orderIndex starting at the base when no prior custom rows exist', async () => {
    selectQueue = [[existingStory], [{ existingCustomCount: 0 }]]
    vi.mocked(aiRunner.generateImage).mockResolvedValue(image())
    const storage = makeStorage()

    await generateCustomIllustrations({ storyId: 1, prompt: 'prompt', count: 4 }, storage)

    expect(aiRunner.generateImage).toHaveBeenCalledTimes(4)
    const insertedBatch = insertedValues[0] as Array<{ orderIndex: number }>
    expect(insertedBatch.map((r) => r.orderIndex)).toEqual([
      CUSTOM_ILLUSTRATION_ORDER_INDEX_BASE,
      CUSTOM_ILLUSTRATION_ORDER_INDEX_BASE + 1,
      CUSTOM_ILLUSTRATION_ORDER_INDEX_BASE + 2,
      CUSTOM_ILLUSTRATION_ORDER_INDEX_BASE + 3,
    ])
  })

  it('keeps successfully generated images and drops failed ones without throwing', async () => {
    selectQueue = [[existingStory], [{ existingCustomCount: 0 }]]
    vi.mocked(aiRunner.generateImage)
      .mockResolvedValueOnce(image())
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce(image())
    const storage = makeStorage()

    await generateCustomIllustrations({ storyId: 1, prompt: 'prompt', count: 3 }, storage)

    const insertedBatch = insertedValues[0] as unknown[]
    expect(insertedBatch).toHaveLength(2)
  })

  it('continues orderIndex numbering after previously generated custom rows for the same story', async () => {
    selectQueue = [[existingStory], [{ existingCustomCount: 2 }]]
    vi.mocked(aiRunner.generateImage).mockResolvedValue(image())
    const storage = makeStorage()

    await generateCustomIllustrations({ storyId: 1, prompt: 'prompt', count: 2 }, storage)

    const insertedBatch = insertedValues[0] as Array<{ orderIndex: number }>
    expect(insertedBatch.map((r) => r.orderIndex)).toEqual([1002, 1003])
  })

  it('marks every inserted row as a custom illustration with no matched characters when none are mentioned', async () => {
    selectQueue = [[existingStory], [{ existingCustomCount: 0 }]]
    vi.mocked(aiRunner.generateImage).mockResolvedValue(image())
    const storage = makeStorage()

    await generateCustomIllustrations({ storyId: 1, prompt: 'prompt', count: 1 }, storage)

    const insertedBatch = insertedValues[0] as Array<{ source: string; characterIds: unknown }>
    expect(insertedBatch.every((row) => row.source === 'custom')).toBe(true)
    expect(insertedBatch.every((row) => row.characterIds === null)).toBe(true)
  })

  it('matches a named character in the prompt and sends their portrait as an identity reference alongside the style anchor', async () => {
    selectQueue = [[existingStory], [{ existingCustomCount: 0 }]]
    vi.mocked(loadStoryCast).mockResolvedValue([
      {
        id: 1,
        name: 'Гоша',
        description: 'Любопытный лисёнок',
        age: '7',
        traits: 'смелый',
        currentPortrait: { storagePath: 'portraits/1/a.png', tier: 'own_reference', generatedAt: new Date() },
      } as never,
    ])
    vi.mocked(aiRunner.generateImage).mockResolvedValue(image())
    const storage = makeStorage()

    await generateCustomIllustrations({ storyId: 1, prompt: 'Гоша идёт по лесу и ищет медальон', count: 1 }, storage)

    const call = vi.mocked(aiRunner.generateImage).mock.calls[0]?.[0]
    expect(call?.referenceImageUrls).toEqual([
      'https://storage.googleapis.com/bedtime-prod-storage/portraits/1/a.png',
      'data:image/png;base64,ZGVmYXVsdA==',
    ])
    expect(call?.prompt).toContain('Гоша идёт по лесу и ищет медальон')
    expect(call?.prompt).toMatch(/Гоша/)

    const insertedBatch = insertedValues[0] as Array<{ characterIds: number[] | null }>
    expect(insertedBatch[0]?.characterIds).toEqual([1])
  })

  it('never sends more than 7 reference images total (6 identity + 1 style anchor) even with more matched characters', async () => {
    const manyCharacters = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      name: `Персонаж${i + 1}`,
      description: '',
      age: null,
      traits: null,
      currentPortrait: { storagePath: `portraits/1/${i + 1}.png`, tier: 'own_reference', generatedAt: new Date() },
    }))
    selectQueue = [[existingStory], [{ existingCustomCount: 0 }]]
    vi.mocked(loadStoryCast).mockResolvedValue(manyCharacters as never)
    vi.mocked(aiRunner.generateImage).mockResolvedValue(image())
    const storage = makeStorage()

    const prompt = manyCharacters.map((c) => c.name).join(' и ') + ' идут в поход'
    await generateCustomIllustrations({ storyId: 1, prompt, count: 1 }, storage)

    const call = vi.mocked(aiRunner.generateImage).mock.calls[0]?.[0]
    expect(call?.referenceImageUrls).toHaveLength(7)
    expect(call?.referenceImageUrls?.at(-1)).toBe('data:image/png;base64,ZGVmYXVsdA==')
  })
})
