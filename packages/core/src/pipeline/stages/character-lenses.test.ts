import { describe, it, expect } from 'vitest'
import { CHARACTER_LENSES, selectCharacterLens, buildCharacterLensBlock } from './character-lenses'

describe('selectCharacterLens', () => {
  it('picks a stable lens for a given storyId', () => {
    expect(selectCharacterLens(42)).toBe(selectCharacterLens(42))
  })

  it('rotates through every lens across a range of storyIds', () => {
    const picked = new Set(
      Array.from({ length: CHARACTER_LENSES.length * 3 }, (_, i) => selectCharacterLens(i).title),
    )

    expect(picked.size).toBe(CHARACTER_LENSES.length)
  })

  it('gives consecutive stories different lenses', () => {
    for (let i = 0; i < 20; i++) {
      expect(selectCharacterLens(i).title).not.toBe(selectCharacterLens(i + 1).title)
    }
  })

  it('falls back to a valid lens when storyId is missing', () => {
    expect(CHARACTER_LENSES).toContain(selectCharacterLens(undefined))
  })
})

describe('buildCharacterLensBlock', () => {
  it('names the chosen lens and its guidance', () => {
    const lens = CHARACTER_LENSES[2]!
    const block = buildCharacterLensBlock(lens)

    expect(block).toContain(lens.title)
    expect(block).toContain(lens.guidance)
  })

  it('enforces the canon/setting boundary to avoid out-of-place characters', () => {
    const block = buildCharacterLensBlock(CHARACTER_LENSES[0]!)

    expect(block).toContain('ГРАНИЦА')
    expect(block).toContain('садиковская группа')
  })
})
