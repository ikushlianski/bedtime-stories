import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockData, resetMockData } = vi.hoisted(() => {
  function makeMockData() {
    return {
      story: null as unknown,
      group: null as unknown,
      characters: [] as unknown[],
      referenceImages: [] as unknown[],
      existingStoryImages: [] as unknown[],
      capturedInserts: [] as Array<{ table: unknown; values: unknown }>,
      capturedUpdates: [] as Array<{ table: unknown; values: unknown }>,
    }
  }

  return { mockData: makeMockData(), resetMockData: makeMockData }
})

vi.mock('@bedtime/core/db/client', async () => {
  const schema = await vi.importActual<typeof import('@bedtime/core/db/schema')>('@bedtime/core/db/schema')

  let lastTable: unknown = null

  function resolveForTable(): unknown {
    if (lastTable === schema.stories) return mockData.story ? [mockData.story] : []
    if (lastTable === schema.storyGroups) return mockData.group ? [mockData.group] : []
    if (lastTable === schema.universeCharacters) return mockData.characters
    if (lastTable === schema.characterReferenceImages) return mockData.referenceImages
    if (lastTable === schema.storyImages) return mockData.existingStoryImages
    return []
  }

  const chain: Record<string, unknown> = {}

  chain['select'] = vi.fn(() => chain)
  chain['from'] = vi.fn((table: unknown) => {
    lastTable = table
    return chain
  })
  chain['where'] = vi.fn(() => chain)
  chain['orderBy'] = vi.fn(() => chain)
  chain['groupBy'] = vi.fn(() => chain)
  chain['insert'] = vi.fn((table: unknown) => {
    lastTable = table
    return chain
  })
  chain['update'] = vi.fn((table: unknown) => {
    lastTable = table
    return chain
  })
  chain['delete'] = vi.fn((table: unknown) => {
    lastTable = table
    return chain
  })
  chain['values'] = vi.fn((values: unknown) => {
    mockData.capturedInserts.push({ table: lastTable, values })
    return chain
  })
  chain['set'] = vi.fn((values: unknown) => {
    mockData.capturedUpdates.push({ table: lastTable, values })
    return chain
  })
  chain['onConflictDoUpdate'] = vi.fn(() => chain)
  chain['returning'] = vi.fn(() => chain)
  chain['then'] = (resolve: (value: unknown) => void) => {
    resolve(resolveForTable())
  }

  return { db: chain }
})

vi.mock('@bedtime/core/storage/gcs-images', () => ({
  isGcsConfigured: vi.fn(() => true),
  readImage: vi.fn(),
  uploadImage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@bedtime/core/pipeline/stages/illustration-moment-selector', () => ({
  selectIllustrationMoments: vi.fn(),
}))

const generateImageSpy = vi.fn()

vi.mock('@bedtime/core/openrouter/openrouter.client', async () => {
  const actual = await vi.importActual<typeof import('@bedtime/core/openrouter/openrouter.client')>(
    '@bedtime/core/openrouter/openrouter.client',
  )

  class MockOpenRouterClient {
    generateImage = generateImageSpy
  }

  return { ...actual, OpenRouterClient: MockOpenRouterClient }
})

vi.mock('@bedtime/core/cost/cost-recorder', () => ({
  costRecorder: { record: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('@bedtime/core/env', () => ({
  env: { OPENROUTER_API_KEY: 'test-key', GCS_BUCKET_NAME: 'test-bucket' },
}))

import { readImage } from '@bedtime/core/storage/gcs-images'
import { selectIllustrationMoments } from '@bedtime/core/pipeline/stages/illustration-moment-selector'
import { generateStoryImages } from './story-images'

describe('generateStoryImages — reference image gate (cost-safety)', () => {
  beforeEach(() => {
    Object.assign(mockData, resetMockData())
    generateImageSpy.mockReset()
    vi.mocked(readImage).mockReset()
    vi.mocked(selectIllustrationMoments).mockReset()

    mockData.story = { id: 1, groupId: 7, textFinal: 'Гоша пошёл гулять.', textV2: null, textV1: null }
    mockData.group = { id: 7, visualStyleGuide: null }
  })

  it('never calls OpenRouterClient.generateImage when the named character has zero reference images', async () => {
    mockData.characters = [{ id: 100, name: 'Гоша', visualDescription: null }]
    mockData.referenceImages = []

    vi.mocked(selectIllustrationMoments).mockResolvedValue({
      scenes: [
        {
          scene_description: 'Гоша выходит из дома.',
          characters_present: ['Гоша'],
          image_prompt: 'A bear character walking out of a cozy house',
        },
      ],
    })

    await generateStoryImages(1)

    expect(generateImageSpy).toHaveBeenCalledTimes(0)

    const failedInsert = mockData.capturedInserts.find(
      (entry) => (entry.values as { status?: string }).status === 'failed',
    )

    expect(failedInsert).toBeDefined()
    expect((failedInsert!.values as { failureReason?: string }).failureReason).toBe(
      'no reference image for character: Гоша',
    )
  })

  it('never calls OpenRouterClient.generateImage when only one of two named characters has a reference image', async () => {
    mockData.characters = [
      { id: 100, name: 'Гоша', visualDescription: null },
      { id: 101, name: 'Мила', visualDescription: null },
    ]
    mockData.referenceImages = [{ characterId: 100, gcsPath: 'character-references/universe-7/character-100/a.png', uploadedAt: new Date() }]

    vi.mocked(selectIllustrationMoments).mockResolvedValue({
      scenes: [
        {
          scene_description: 'Гоша и Мила играют вместе.',
          characters_present: ['Гоша', 'Мила'],
          image_prompt: 'Two characters playing together in a meadow',
        },
      ],
    })

    await generateStoryImages(1)

    expect(generateImageSpy).toHaveBeenCalledTimes(0)

    const failedInsert = mockData.capturedInserts.find(
      (entry) => (entry.values as { status?: string }).status === 'failed',
    )

    expect((failedInsert!.values as { failureReason?: string }).failureReason).toBe(
      'no reference image for character: Мила',
    )
  })

  it('calls OpenRouterClient.generateImage exactly once when the named character has a reference image', async () => {
    mockData.characters = [{ id: 100, name: 'Гоша', visualDescription: null }]
    mockData.referenceImages = [{ characterId: 100, gcsPath: 'character-references/universe-7/character-100/a.png', uploadedAt: new Date() }]

    vi.mocked(readImage).mockResolvedValue({ bytes: Buffer.from('hello'), contentType: 'image/png' })
    vi.mocked(selectIllustrationMoments).mockResolvedValue({
      scenes: [
        {
          scene_description: 'Гоша выходит из дома.',
          characters_present: ['Гоша'],
          image_prompt: 'A bear character walking out of a cozy house',
        },
      ],
    })

    generateImageSpy.mockResolvedValue({
      imageBase64: 'aGVsbG8=',
      mediaType: 'image/png',
      usage: { promptTokens: 10, completionTokens: 20, costUsd: 0.01 },
    })

    await generateStoryImages(1)

    expect(generateImageSpy).toHaveBeenCalledTimes(1)
    const call = generateImageSpy.mock.calls[0]?.[0] as { referenceImages: Array<{ base64: string; mediaType: string }> }
    expect(call.referenceImages).toEqual([{ base64: 'aGVsbG8=', mediaType: 'image/png' }])
  })

  it('generates ungated for a scene naming no characters at all', async () => {
    mockData.characters = [{ id: 100, name: 'Гоша', visualDescription: null }]
    mockData.referenceImages = []

    vi.mocked(selectIllustrationMoments).mockResolvedValue({
      scenes: [
        {
          scene_description: 'Тихий лес на закате.',
          characters_present: [],
          image_prompt: 'A quiet forest at sunset, establishing shot',
        },
      ],
    })

    generateImageSpy.mockResolvedValue({
      imageBase64: 'aGVsbG8=',
      mediaType: 'image/png',
      usage: { promptTokens: 10, completionTokens: 20, costUsd: 0.01 },
    })

    await generateStoryImages(1)

    expect(generateImageSpy).toHaveBeenCalledTimes(1)
    const call = generateImageSpy.mock.calls[0]?.[0] as { referenceImages: unknown[] }
    expect(call.referenceImages).toEqual([])
  })
})
