import { describe, expect, it } from 'vitest'
import {
  buildReactionPreferenceBlock,
  MIN_REACTIONS,
  RECENT_MOMENTS_M,
  summarizeReactions,
  TOP_CHARACTERS_N,
  type ReactionRow,
  type ReactionSummary,
} from './reaction-preferences'

function row(overrides: Partial<ReactionRow> = {}): ReactionRow {
  return {
    enjoyed: null,
    wasFunny: null,
    wasScary: null,
    tooLong: null,
    wantAgain: null,
    favoriteMoment: null,
    favoriteCharacter: null,
    ...overrides,
  }
}

function summary(overrides: Partial<ReactionSummary> = {}): ReactionSummary {
  return {
    sampleSize: MIN_REACTIONS,
    topFavoriteCharacters: [],
    recentFavoriteMoments: [],
    funnyLanded: false,
    wantAgainStrong: false,
    tooScary: false,
    tooLong: false,
    ...overrides,
  }
}

describe('summarizeReactions', () => {
  it('returns a zeroed summary for empty input', () => {
    expect(summarizeReactions([])).toEqual({
      sampleSize: 0,
      topFavoriteCharacters: [],
      recentFavoriteMoments: [],
      funnyLanded: false,
      wantAgainStrong: false,
      tooScary: false,
      tooLong: false,
    })
  })

  it('ranks favorite characters by frequency and caps at TOP_CHARACTERS_N', () => {
    const rows = [
      row({ favoriteCharacter: 'Мира' }),
      row({ favoriteCharacter: 'Мира' }),
      row({ favoriteCharacter: 'Гоша' }),
      row({ favoriteCharacter: 'Рыбка' }),
      row({ favoriteCharacter: 'Рыбка' }),
      row({ favoriteCharacter: 'Рыбка' }),
    ]

    const result = summarizeReactions(rows)

    expect(result.topFavoriteCharacters).toHaveLength(TOP_CHARACTERS_N)
    expect(result.topFavoriteCharacters).toEqual(['Рыбка', 'Мира'])
  })

  it('dedupes favorite characters case-insensitively', () => {
    const rows = [
      row({ favoriteCharacter: 'Мира' }),
      row({ favoriteCharacter: 'мира' }),
      row({ favoriteCharacter: '  МИРА  ' }),
    ]

    const result = summarizeReactions(rows)

    expect(result.topFavoriteCharacters).toEqual(['Мира'])
  })

  it('ignores null and empty favoriteCharacter and favoriteMoment values', () => {
    const rows = [
      row({ favoriteCharacter: null, favoriteMoment: null }),
      row({ favoriteCharacter: '   ', favoriteMoment: '   ' }),
      row({ favoriteCharacter: 'Мира', favoriteMoment: 'когда рыбка заговорила' }),
    ]

    const result = summarizeReactions(rows)

    expect(result.topFavoriteCharacters).toEqual(['Мира'])
    expect(result.recentFavoriteMoments).toEqual(['когда рыбка заговорила'])
  })

  it('keeps recent favorite moments in input order and caps at RECENT_MOMENTS_M', () => {
    const rows = [
      row({ favoriteMoment: 'момент 1' }),
      row({ favoriteMoment: 'момент 2' }),
      row({ favoriteMoment: 'момент 3' }),
      row({ favoriteMoment: 'момент 4' }),
    ]

    const result = summarizeReactions(rows)

    expect(result.recentFavoriteMoments).toHaveLength(RECENT_MOMENTS_M)
    expect(result.recentFavoriteMoments).toEqual(['момент 1', 'момент 2', 'момент 3'])
  })

  it('sets funnyLanded when the wasFunny proportion meets FUNNY_FLAG', () => {
    const rows = [
      row({ wasFunny: true }),
      row({ wasFunny: true }),
      row({ wasFunny: false }),
      row({ wasFunny: false }),
    ]

    expect(summarizeReactions(rows).funnyLanded).toBe(true)
  })

  it('keeps funnyLanded false just below FUNNY_FLAG', () => {
    const rows = [
      row({ wasFunny: true }),
      row({ wasFunny: false }),
      row({ wasFunny: false }),
    ]

    expect(summarizeReactions(rows).funnyLanded).toBe(false)
  })

  it('sets tooScary and tooLong over non-null values only', () => {
    const rows = [
      row({ wasScary: true, tooLong: true }),
      row({ wasScary: null, tooLong: null }),
      row({ wasScary: false, tooLong: false }),
    ]

    const result = summarizeReactions(rows)

    expect(result.tooScary).toBe(true)
    expect(result.tooLong).toBe(true)
  })
})

describe('buildReactionPreferenceBlock', () => {
  it('returns an empty string when sampleSize is below MIN_REACTIONS', () => {
    expect(buildReactionPreferenceBlock(summary({ sampleSize: MIN_REACTIONS - 1 }))).toBe('')
  })

  it('names a top favorite character in the block when one is present', () => {
    const block = buildReactionPreferenceBlock(summary({ topFavoriteCharacters: ['Мира'] }))

    expect(block).toContain('Мира')
  })

  it('includes the canon and place guardrail wording when a character is present', () => {
    const block = buildReactionPreferenceBlock(summary({ topFavoriteCharacters: ['Мира'] }))

    expect(block).toContain('по канону и по месту действия')
  })

  it('includes a calmer-tone instruction only when tooScary is true', () => {
    const withScary = buildReactionPreferenceBlock(summary({ tooScary: true }))
    const withoutScary = buildReactionPreferenceBlock(summary({ tooScary: false }))

    expect(withScary).toContain('ЭМОЦИОНАЛЬНУЮ ЗАДАЧУ')
    expect(withoutScary).not.toContain('ЭМОЦИОНАЛЬНУЮ ЗАДАЧУ')
  })

  it('includes a tighten instruction when tooLong is true', () => {
    const block = buildReactionPreferenceBlock(summary({ tooLong: true }))

    expect(block).toContain('5–7 сцен')
  })

  it('omits the humor-confidence line when neither funnyLanded nor wantAgainStrong is set', () => {
    const block = buildReactionPreferenceBlock(summary({ funnyLanded: false, wantAgainStrong: false }))

    expect(block).not.toContain('МОМЕНТЫ СМЕХА')
  })
})
