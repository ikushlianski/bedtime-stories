import { describe, it, expect } from 'vitest'
import { STORY_STRUCTURES, selectStoryStructure, buildStructureBlock } from './plotter'

describe('selectStoryStructure', () => {
  it('picks a stable structure for a given storyId', () => {
    expect(selectStoryStructure(3)).toBe(selectStoryStructure(3))
  })

  it('rotates through structures for consecutive storyIds', () => {
    const picked = new Set(
      Array.from({ length: STORY_STRUCTURES.length }, (_, i) => selectStoryStructure(i).title),
    )

    expect(picked.size).toBe(STORY_STRUCTURES.length)
  })

  it('gives consecutive stories different skeletons', () => {
    expect(selectStoryStructure(7).title).not.toBe(selectStoryStructure(8).title)
  })

  it('falls back to a valid structure when storyId is missing', () => {
    expect(STORY_STRUCTURES).toContain(selectStoryStructure(undefined))
  })
})

describe('buildStructureBlock', () => {
  it('forbids the funny-everyone-laughs ending', () => {
    const block = buildStructureBlock(STORY_STRUCTURES[0]!)

    expect(block).toContain('ЗАПРЕЩЁННАЯ КОНЦОВКА')
  })

  it('names the chosen pattern and its ending', () => {
    const structure = STORY_STRUCTURES[4]!
    const block = buildStructureBlock(structure)

    expect(block).toContain(structure.title)
    expect(block).toContain(structure.ending)
  })
})
