import { describe, it, expect } from 'vitest'
import { deriveReferenceImageUpdate } from './reference-image-update'

describe('deriveReferenceImageUpdate', () => {
  it('sets the reference image when the universe has none yet', () => {
    const result = deriveReferenceImageUpdate({
      currentReferenceImagePath: null,
      newSuccessPath: 'story-images/universe-7/story-42/scene-0.png',
    })

    expect(result).toEqual({ shouldUpdate: true, newPath: 'story-images/universe-7/story-42/scene-0.png' })
  })

  it('never overwrites an existing reference image', () => {
    const result = deriveReferenceImageUpdate({
      currentReferenceImagePath: 'story-images/universe-7/story-10/scene-0.png',
      newSuccessPath: 'story-images/universe-7/story-42/scene-0.png',
    })

    expect(result).toEqual({ shouldUpdate: false, newPath: null })
  })
})
