import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matchSuggestedTopicIds, type LiveTopicSuggestion } from './suggest-live-topics'

describe('matchSuggestedTopicIds', () => {
  const pool: LiveTopicSuggestion[] = [
    { id: 1, title: 'A', note: null },
    { id: 2, title: 'B', note: 'note' },
    { id: 3, title: 'C', note: null },
  ]

  it('keeps only ids that exist in the pool', () => {
    expect(matchSuggestedTopicIds([2, 99, 1], pool)).toEqual([pool[1], pool[0]])
  })

  it('deduplicates repeated ids', () => {
    expect(matchSuggestedTopicIds([1, 1, 2], pool)).toEqual([pool[0], pool[1]])
  })

  it('caps the result at the maximum suggestion count', () => {
    const bigPool: LiveTopicSuggestion[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      title: `T${i + 1}`,
      note: null,
    }))
    const ids = bigPool.map((t) => t.id)

    expect(matchSuggestedTopicIds(ids, bigPool)).toHaveLength(4)
  })

  it('returns an empty array when nothing matches', () => {
    expect(matchSuggestedTopicIds([99], pool)).toEqual([])
  })
})

const selectMock = vi.fn()
const recommendCheapestModelMock = vi.fn()
const suggestLiveTopicsMock = vi.fn()

vi.mock('../db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}))

vi.mock('../openrouter/recommend-model', () => ({
  recommendCheapestModel: (...args: unknown[]) => recommendCheapestModelMock(...args),
}))

vi.mock('./stages/live-topic-suggester', () => ({
  suggestLiveTopics: (...args: unknown[]) => suggestLiveTopicsMock(...args),
}))

const { suggestLiveTopicsForOutline } = await import('./suggest-live-topics')

describe('suggestLiveTopicsForOutline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips the AI call entirely when the outline is too short', async () => {
    const result = await suggestLiveTopicsForOutline(1, 'too short')

    expect(result).toEqual([])
    expect(selectMock).not.toHaveBeenCalled()
    expect(suggestLiveTopicsMock).not.toHaveBeenCalled()
  })

  it('skips the AI call when the universe has no active topics', async () => {
    selectMock.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    })

    const result = await suggestLiveTopicsForOutline(1, 'a'.repeat(30))

    expect(result).toEqual([])
    expect(suggestLiveTopicsMock).not.toHaveBeenCalled()
  })

  it('skips the AI call when no model supports structured output', async () => {
    selectMock.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 1, title: 'T', note: null }]),
    })
    recommendCheapestModelMock.mockResolvedValue(null)

    const result = await suggestLiveTopicsForOutline(1, 'a'.repeat(30))

    expect(result).toEqual([])
    expect(suggestLiveTopicsMock).not.toHaveBeenCalled()
  })

  it('returns the AI-matched topics from the active pool', async () => {
    const pool = [
      { id: 1, title: 'T1', note: null },
      { id: 2, title: 'T2', note: 'n' },
    ]

    selectMock.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(pool),
    })
    recommendCheapestModelMock.mockResolvedValue('cheap/model')
    suggestLiveTopicsMock.mockResolvedValue({ topicIds: [2] })

    const result = await suggestLiveTopicsForOutline(7, 'a'.repeat(30))

    expect(recommendCheapestModelMock).toHaveBeenCalledWith({ needsJsonSchema: true, minOutputTokens: 300 })
    expect(suggestLiveTopicsMock).toHaveBeenCalledWith({ outline: 'a'.repeat(30), topics: pool, model: 'cheap/model' })
    expect(result).toEqual([pool[1]])
  })
})
