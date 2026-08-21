import { describe, it, expect } from 'vitest'
import { loadDefaultStyleImageDataUri } from './load-default-style-image'

describe('loadDefaultStyleImageDataUri', () => {
  it('loads the bundled default style reference image as a base64 PNG data URI', async () => {
    const dataUri = await loadDefaultStyleImageDataUri()

    expect(dataUri.startsWith('data:image/png;base64,')).toBe(true)
    expect(dataUri.length).toBeGreaterThan(1000)
  })
})
