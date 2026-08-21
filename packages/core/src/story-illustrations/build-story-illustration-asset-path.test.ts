import { describe, it, expect } from 'vitest'
import { buildStoryIllustrationAssetPath } from './build-story-illustration-asset-path'

describe('buildStoryIllustrationAssetPath', () => {
  it('puts an illustration under the top-level illustrations/ prefix, namespaced by story id', () => {
    const path = buildStoryIllustrationAssetPath({ storyId: 812, fileId: 'abc-123', extension: 'png' })

    expect(path).toBe('illustrations/812/abc-123.png')
  })

  it('does not nest under a shared characters/ or portraits/ prefix', () => {
    const path = buildStoryIllustrationAssetPath({ storyId: 1, fileId: 'x', extension: 'jpg' })

    expect(path.startsWith('portraits/')).toBe(false)
    expect(path.startsWith('illustrations/')).toBe(true)
  })

  it('strips a leading dot from the extension', () => {
    const path = buildStoryIllustrationAssetPath({ storyId: 7, fileId: 'y', extension: '.webp' })

    expect(path).toBe('illustrations/7/y.webp')
  })
})
