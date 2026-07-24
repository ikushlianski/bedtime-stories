import { describe, it, expect } from 'vitest'
import { deriveContentTypeExtension } from './content-type-extension'

describe('deriveContentTypeExtension', () => {
  it('maps image/png to png', () => {
    expect(deriveContentTypeExtension('image/png')).toBe('png')
  })

  it('maps image/jpeg to jpg', () => {
    expect(deriveContentTypeExtension('image/jpeg')).toBe('jpg')
  })

  it('maps image/webp to webp', () => {
    expect(deriveContentTypeExtension('image/webp')).toBe('webp')
  })

  it('is case-insensitive', () => {
    expect(deriveContentTypeExtension('IMAGE/PNG')).toBe('png')
  })

  it('rejects an unsupported content type', () => {
    expect(deriveContentTypeExtension('application/pdf')).toBeNull()
  })

  it('rejects a disguised executable content type', () => {
    expect(deriveContentTypeExtension('application/x-msdownload')).toBeNull()
  })

  it('rejects an empty string', () => {
    expect(deriveContentTypeExtension('')).toBeNull()
  })
})
