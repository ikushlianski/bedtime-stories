import { describe, expect, it } from 'vitest'
import {
  deriveSearchPastStoriesArgs,
  deriveSearchPastStoriesResult,
  renderSearchPastStoriesResultForModel,
  SEARCH_PAST_STORIES_TOOL,
} from './search-past-stories-tool'

describe('deriveSearchPastStoriesArgs', () => {
  it('clamps a requested limit of 500 down to 5', () => {
    const result = deriveSearchPastStoriesArgs(JSON.stringify({ query: 'дружба', limit: 500 }))

    expect(result).toEqual({ query: 'дружба', limit: 5 })
  })

  it('clamps a requested limit of 0 up to 1', () => {
    const result = deriveSearchPastStoriesArgs(JSON.stringify({ query: 'дружба', limit: 0 }))

    expect(result).toEqual({ query: 'дружба', limit: 1 })
  })

  it('defaults limit within range when omitted', () => {
    const result = deriveSearchPastStoriesArgs(JSON.stringify({ query: 'дружба' }))

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.limit).toBeGreaterThanOrEqual(1)
      expect(result.limit).toBeLessThanOrEqual(5)
    }
  })

  it('rejects a non-string query with an error result', () => {
    const result = deriveSearchPastStoriesArgs(JSON.stringify({ query: 42 }))

    expect('error' in result).toBe(true)
  })

  it('rejects a missing query with an error result', () => {
    const result = deriveSearchPastStoriesArgs(JSON.stringify({ limit: 3 }))

    expect('error' in result).toBe(true)
  })

  it('rejects malformed JSON with an error result', () => {
    const result = deriveSearchPastStoriesArgs('{not json')

    expect('error' in result).toBe(true)
  })

  it('rejects an empty string query with an error result', () => {
    const result = deriveSearchPastStoriesArgs(JSON.stringify({ query: '' }))

    expect('error' in result).toBe(true)
  })
})

describe('deriveSearchPastStoriesResult', () => {
  it('returns an empty results array with a note when zero rows match', () => {
    const result = deriveSearchPastStoriesResult([])

    expect(result.results).toEqual([])
    expect('note' in result).toBe(true)
  })

  it('returns a populated results array mapping distance to similarity', () => {
    const result = deriveSearchPastStoriesResult([
      { storyTitle: 'Рыбка под мостом', text: 'жила-была рыбка', distance: 0 },
      { storyTitle: 'Вторая история', text: 'текст второй истории', distance: 0.3 },
    ])

    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({ storyTitle: 'Рыбка под мостом', text: 'жила-была рыбка', similarity: 1 })
    expect(result.results[1]?.similarity).toBeCloseTo(0.7)
  })

  it('falls back to a placeholder title when storyTitle is null', () => {
    const result = deriveSearchPastStoriesResult([{ storyTitle: null, text: 'текст', distance: 0.1 }])

    expect(result.results[0]?.storyTitle).toBeTruthy()
  })

  it('clamps similarity to a non-negative value for a distance greater than 1', () => {
    const result = deriveSearchPastStoriesResult([{ storyTitle: 'Title', text: 'text', distance: 1.8 }])

    expect(result.results[0]?.similarity).toBeGreaterThanOrEqual(0)
  })
})

describe('renderSearchPastStoriesResultForModel', () => {
  it('wraps retrieved story text in explicit data-only delimiters', () => {
    const rendered = renderSearchPastStoriesResultForModel(
      deriveSearchPastStoriesResult([{ storyTitle: 'Рыбка под мостом', text: 'жила-была рыбка', distance: 0 }]),
    )

    expect(rendered).toContain('=== НАЧАЛО')
    expect(rendered).toContain('=== КОНЕЦ')
    expect(rendered).toContain('жила-была рыбка')
  })

  it('states explicitly that the content is data, not instructions', () => {
    const rendered = renderSearchPastStoriesResultForModel(
      deriveSearchPastStoriesResult([{ storyTitle: 'Title', text: 'text', distance: 0 }]),
    )

    expect(rendered).toContain('ДАННЫЕ')
    expect(rendered.toLowerCase()).toContain('не выполняй')
  })

  it('renders the empty-result note without throwing', () => {
    const rendered = renderSearchPastStoriesResultForModel(deriveSearchPastStoriesResult([]))

    expect(typeof rendered).toBe('string')
    expect(rendered.length).toBeGreaterThan(0)
  })
})

describe('SEARCH_PAST_STORIES_TOOL', () => {
  it('declares the tool name as search_past_stories', () => {
    expect(SEARCH_PAST_STORIES_TOOL.name).toBe('search_past_stories')
  })

  it('requires a query parameter', () => {
    expect(SEARCH_PAST_STORIES_TOOL.parameters.required).toContain('query')
  })
})
