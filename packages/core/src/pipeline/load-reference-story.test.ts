import { describe, expect, it, vi, beforeEach } from 'vitest'
import { loadReferenceStory } from './load-reference-story'

let mockResults: unknown[][] = []

vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => mockResults.shift() ?? []),
      })),
    })),
  },
}))

describe('loadReferenceStory', () => {
  beforeEach(() => {
    mockResults = []
  })

  it('returns null when the story has no referenceStoryId set', async () => {
    mockResults = [[{ referenceStoryId: null }]]

    const result = await loadReferenceStory(1)

    expect(result).toBeNull()
  })

  it('returns null when the story itself does not exist', async () => {
    mockResults = [[]]

    const result = await loadReferenceStory(999)

    expect(result).toBeNull()
  })

  it('returns the referenced story title and text when it has finalized text', async () => {
    mockResults = [
      [{ referenceStoryId: 42 }],
      [{ title: 'Гоша и лес', textFinal: 'Однажды...' }],
    ]

    const result = await loadReferenceStory(1)

    expect(result).toEqual({ title: 'Гоша и лес', textFinal: 'Однажды...' })
  })

  it('returns null when the referenced story has no finalized text', async () => {
    mockResults = [
      [{ referenceStoryId: 42 }],
      [{ title: 'Гоша и лес', textFinal: null }],
    ]

    const result = await loadReferenceStory(1)

    expect(result).toBeNull()
  })

  it('returns null when the referenced story row no longer exists', async () => {
    mockResults = [
      [{ referenceStoryId: 42 }],
      [],
    ]

    const result = await loadReferenceStory(1)

    expect(result).toBeNull()
  })
})
