import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveStoryStructureChoice } from './resolve-story-structure-choice'
import { STORY_STRUCTURES, selectStoryStructure } from './stages/story-structures'
import { CHARACTER_LENSES, selectCharacterLens } from './stages/character-lenses'

const limitMock = vi.fn()

vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: limitMock,
        })),
      })),
    })),
  },
}))

describe('resolveStoryStructureChoice', () => {
  beforeEach(() => {
    limitMock.mockReset()
  })

  it('uses the stored structure and lens keys when present', async () => {
    const storedStructure = STORY_STRUCTURES[3]!
    const storedLens = CHARACTER_LENSES[1]!
    limitMock.mockResolvedValue([{ structureKey: storedStructure.key, lensKey: storedLens.key }])

    const result = await resolveStoryStructureChoice(1)

    expect(result.structure).toBe(storedStructure)
    expect(result.lens).toBe(storedLens)
  })

  it('falls back to rotation-by-storyId when no row is found', async () => {
    limitMock.mockResolvedValue([])

    const result = await resolveStoryStructureChoice(7)

    expect(result.structure).toBe(selectStoryStructure(7))
    expect(result.lens).toBe(selectCharacterLens(7))
  })

  it('falls back to rotation-by-storyId when the stored keys are null', async () => {
    limitMock.mockResolvedValue([{ structureKey: null, lensKey: null }])

    const result = await resolveStoryStructureChoice(9)

    expect(result.structure).toBe(selectStoryStructure(9))
    expect(result.lens).toBe(selectCharacterLens(9))
  })

  it('falls back to rotation-by-storyId when a stored key is unknown', async () => {
    limitMock.mockResolvedValue([{ structureKey: 'not-a-real-key', lensKey: 'also-not-real' }])

    const result = await resolveStoryStructureChoice(9)

    expect(result.structure).toBe(selectStoryStructure(9))
    expect(result.lens).toBe(selectCharacterLens(9))
  })

  it('resolves the same choice across repeated calls for the same storyId', async () => {
    limitMock.mockResolvedValue([])

    const first = await resolveStoryStructureChoice(12)
    const second = await resolveStoryStructureChoice(12)

    expect(first.structure).toBe(second.structure)
    expect(first.lens).toBe(second.lens)
  })
})
