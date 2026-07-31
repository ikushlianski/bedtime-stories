import { describe, expect, it, vi } from 'vitest'

vi.mock('../env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
    OPENROUTER_API_KEY: 'test-key',
    JWT_SECRET: 'x'.repeat(32),
  },
}))

import { deriveStorySearchApiResults } from './search-stories-by-embedding'

describe('deriveStorySearchApiResults', () => {
  it('maps distance to similarity and keeps the story id for linking', () => {
    const result = deriveStorySearchApiResults([
      { storyId: 7, storyTitle: 'Рыбка под мостом', text: 'жила-была рыбка', distance: 0 },
    ])

    expect(result).toEqual([
      { storyId: 7, title: 'Рыбка под мостом', similarity: 1, excerpt: 'жила-была рыбка' },
    ])
  })

  it('falls back to a placeholder title when storyTitle is null', () => {
    const result = deriveStorySearchApiResults([{ storyId: 1, storyTitle: null, text: 'текст', distance: 0.1 }])

    expect(result[0]?.title).toBeTruthy()
  })

  it('clamps similarity to a non-negative value for a distance greater than 1', () => {
    const result = deriveStorySearchApiResults([{ storyId: 1, storyTitle: 'Title', text: 'text', distance: 1.8 }])

    expect(result[0]?.similarity).toBeGreaterThanOrEqual(0)
  })

  it('truncates long story text into a short excerpt', () => {
    const longText = 'а'.repeat(500)
    const result = deriveStorySearchApiResults([{ storyId: 1, storyTitle: 'Title', text: longText, distance: 0 }])

    expect(result[0]?.excerpt.length).toBeLessThan(longText.length)
    expect(result[0]?.excerpt.endsWith('…')).toBe(true)
  })

  it('returns an empty array for zero rows', () => {
    expect(deriveStorySearchApiResults([])).toEqual([])
  })
})
