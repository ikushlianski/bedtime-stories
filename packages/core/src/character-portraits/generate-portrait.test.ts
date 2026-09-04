import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ObjectStorage } from '../storage/object-storage.interface'

let selectQueue: unknown[][] = []
let selectCallIndex = 0
let insertedRows: unknown[] = []
let insertReturnRow: unknown = null
let updateCalls: unknown[] = []
let deleteCalls: unknown[] = []

function makeSelectBuilder(rows: unknown[]) {
  const builder = {
    from: () => builder,
    innerJoin: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (rows: unknown[]) => void) => resolve(rows),
  }
  return builder
}

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(() => makeSelectBuilder(selectQueue[selectCallIndex++] ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertedRows.push(values)
        return { returning: vi.fn(async () => [insertReturnRow]) }
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((setValues: unknown) => ({
        where: vi.fn(async () => {
          updateCalls.push(setValues)
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async (cond: unknown) => {
        deleteCalls.push(cond)
      }),
    })),
  },
}))

vi.mock('../ai/index.js', () => ({ aiRunner: { generateImage: vi.fn() } }))
vi.mock('node:fs/promises', () => ({ readFile: vi.fn(async () => Buffer.from('fake-default-image')) }))
vi.mock('../env.js', () => ({ env: { GCS_BUCKET_NAME: 'bedtime-prod-storage' } }))

import {
  generatePortrait,
  PortraitGenerationError,
  PortraitSaveError,
  CharacterNotFoundError,
  PORTRAIT_MODEL,
} from './generate-portrait'
import { aiRunner } from '../ai/index.js'
import { ModelNotInCatalogError } from '../openrouter/openrouter.runner.js'

const character = {
  id: 1,
  universeId: 10,
  name: 'Gosha',
  description: 'A curious fox',
  age: '7',
  traits: 'brave',
}

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

describe('generatePortrait', () => {
  beforeEach(() => {
    selectQueue = []
    selectCallIndex = 0
    insertedRows = []
    insertReturnRow = {
      id: 10,
      characterId: 1,
      storagePath: 'portraits/1/xyz.png',
      tier: 'own_reference',
      sourceStoragePaths: ['references/1/a.png'],
      isCurrent: true,
      generatedAt: new Date(2000),
    }
    updateCalls = []
    deleteCalls = []
    vi.mocked(aiRunner.generateImage).mockReset()
  })

  it('throws when the character does not exist', async () => {
    selectQueue = [[]]
    const storage = makeStorage()

    await expect(generatePortrait({ characterId: 999 }, storage)).rejects.toBeInstanceOf(CharacterNotFoundError)
  })

  it('uses the own_reference tier, signing each reference fresh, when the character has references (Scenario 2)', async () => {
    selectQueue = [[character], [{ storagePath: 'references/1/a.png' }], [], []]
    vi.mocked(aiRunner.generateImage).mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    const storage = makeStorage()

    const result = await generatePortrait({ characterId: 1 }, storage)

    expect(storage.getSignedReadUrl).toHaveBeenCalledWith('references/1/a.png', expect.any(Number))
    const call = vi.mocked(aiRunner.generateImage).mock.calls[0]?.[0]
    expect(call?.model).toBe(PORTRAIT_MODEL)
    expect(call?.characterId).toBe(1)
    expect(call?.referenceImageUrls).toEqual([
      'https://signed.example.com/references/1/a.png',
      expect.stringMatching(/^data:image\/png;base64,/),
    ])
    expect(call?.prompt).toMatch(/match/i)
    expect(call?.prompt).toMatch(/style guide/i)

    expect(insertedRows[0]).toMatchObject({ characterId: 1, tier: 'own_reference', isCurrent: true, sourceStoragePaths: ['references/1/a.png'] })
    expect(updateCalls).toEqual([{ isCurrent: false }])
    expect(result.tier).toBe('own_reference')
    expect(result.imageUrl).toContain('portraits/1/xyz.png')
  })

  it('uses the universe_sibling tier with public URLs when the character has no references but siblings exist (Scenario 3)', async () => {
    selectQueue = [[character], [], [{ storagePath: 'portraits/2/sib.png' }], []]
    insertReturnRow = { ...insertReturnRow, tier: 'universe_sibling' }
    vi.mocked(aiRunner.generateImage).mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    const storage = makeStorage()

    await generatePortrait({ characterId: 1 }, storage)

    expect(storage.getSignedReadUrl).not.toHaveBeenCalled()
    const call = vi.mocked(aiRunner.generateImage).mock.calls[0]?.[0]
    expect(call?.referenceImageUrls).toEqual([
      'https://storage.googleapis.com/bedtime-prod-storage/portraits/2/sib.png',
      expect.stringMatching(/^data:image\/png;base64,/),
    ])
    expect(call?.prompt).toMatch(/invent/i)
    expect(call?.prompt).toMatch(/style guide/i)
    expect(insertedRows[0]).toMatchObject({ tier: 'universe_sibling', sourceStoragePaths: ['portraits/2/sib.png'] })
  })

  it('uses the default_style tier with the bundled asset when nothing else is available (Scenario 4)', async () => {
    selectQueue = [[character], [], [], []]
    insertReturnRow = { ...insertReturnRow, tier: 'default_style', sourceStoragePaths: null }
    vi.mocked(aiRunner.generateImage).mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    const storage = makeStorage()

    await generatePortrait({ characterId: 1 }, storage)

    const call = vi.mocked(aiRunner.generateImage).mock.calls[0]?.[0]
    expect(call?.referenceImageUrls?.[0]).toMatch(/^data:image\/png;base64,/)
    expect(insertedRows[0]).toMatchObject({ tier: 'default_style', sourceStoragePaths: null })
  })

  it('flips every other current portrait to previous (self-healing even if more than one was left current) and prunes beyond 3 previous rows (Scenario 5)', async () => {
    selectQueue = [
      [character],
      [],
      [],
      [
        { id: 1, generatedAt: new Date(4000) },
        { id: 2, generatedAt: new Date(3000) },
        { id: 3, generatedAt: new Date(2000) },
        { id: 4, generatedAt: new Date(1000) },
      ],
    ]
    vi.mocked(aiRunner.generateImage).mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    const storage = makeStorage()

    await generatePortrait({ characterId: 1 }, storage)

    expect(updateCalls).toEqual([{ isCurrent: false }])
    expect(deleteCalls).toHaveLength(1)
  })

  it('rethrows a missing-model-catalog error undisguised, without wrapping it as a generation failure', async () => {
    selectQueue = [[character], [], []]
    vi.mocked(aiRunner.generateImage).mockRejectedValueOnce(new ModelNotInCatalogError('google/gemini-2.5-flash-image'))
    const storage = makeStorage()

    const error = await generatePortrait({ characterId: 1 }, storage).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ModelNotInCatalogError)
    expect(error).not.toBeInstanceOf(PortraitGenerationError)
  })

  it('throws PortraitGenerationError without touching storage or the database when OpenRouter fails (Scenario 8)', async () => {
    selectQueue = [[character], [], []]
    vi.mocked(aiRunner.generateImage).mockRejectedValueOnce(new Error('provider rejected the request'))
    const storage = makeStorage()

    await expect(generatePortrait({ characterId: 1 }, storage)).rejects.toBeInstanceOf(PortraitGenerationError)

    expect(storage.upload).not.toHaveBeenCalled()
    expect(insertedRows).toHaveLength(0)
  })

  it('throws a distinct PortraitSaveError when the billed generation succeeds but the upload fails (Scenario 9)', async () => {
    selectQueue = [[character], [], []]
    vi.mocked(aiRunner.generateImage).mockResolvedValueOnce({ imageBase64: Buffer.from('img').toString('base64'), mediaType: 'image/png' })
    const storage = makeStorage()
    vi.mocked(storage.upload).mockRejectedValueOnce(new Error('gcs unavailable'))

    const error = await generatePortrait({ characterId: 1 }, storage).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(PortraitSaveError)
    expect(error).not.toBeInstanceOf(PortraitGenerationError)
    expect(insertedRows).toHaveLength(0)
  })
})
