import { describe, it, expect } from 'vitest'
import { deriveImageStoragePath } from './image-storage-path'

describe('deriveImageStoragePath', () => {
  it('includes the universe segment when the story belongs to a universe', () => {
    const result = deriveImageStoragePath({ universeId: 7, storyId: 42, sequenceIndex: 0 })

    expect(result).toBe('story-images/universe-7/story-42/scene-0.png')
  })

  it('falls back to a no-universe segment when the story has no group', () => {
    const result = deriveImageStoragePath({ universeId: null, storyId: 42, sequenceIndex: 1 })

    expect(result).toBe('story-images/no-universe/story-42/scene-1.png')
  })

  it('produces distinct paths per sequence index within the same story', () => {
    const first = deriveImageStoragePath({ universeId: 7, storyId: 42, sequenceIndex: 0 })
    const second = deriveImageStoragePath({ universeId: 7, storyId: 42, sequenceIndex: 2 })

    expect(first).not.toBe(second)
  })
})
