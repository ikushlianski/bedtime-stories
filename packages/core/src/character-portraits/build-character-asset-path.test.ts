import { describe, it, expect } from 'vitest'
import { buildCharacterAssetPath } from './build-character-asset-path'

describe('buildCharacterAssetPath', () => {
  it('puts a reference under the top-level references/ prefix', () => {
    const path = buildCharacterAssetPath({ kind: 'reference', characterId: 42, fileId: 'abc-123', extension: 'png' })

    expect(path).toBe('references/42/abc-123.png')
  })

  it('puts a portrait under the top-level portraits/ prefix', () => {
    const path = buildCharacterAssetPath({ kind: 'portrait', characterId: 42, fileId: 'abc-123', extension: 'png' })

    expect(path).toBe('portraits/42/abc-123.png')
  })

  it('does not nest references and portraits under a shared characters/ prefix', () => {
    const path = buildCharacterAssetPath({ kind: 'reference', characterId: 1, fileId: 'x', extension: 'jpg' })

    expect(path.startsWith('characters/')).toBe(false)
    expect(path.startsWith('references/')).toBe(true)
  })

  it('strips a leading dot from the extension', () => {
    const path = buildCharacterAssetPath({ kind: 'portrait', characterId: 7, fileId: 'y', extension: '.webp' })

    expect(path).toBe('portraits/7/y.webp')
  })
})
