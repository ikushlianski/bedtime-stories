import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { deriveEmbeddingInput } from './embed-story'

describe('deriveEmbeddingInput', () => {
  it('returns null when the story has no usable text', () => {
    const result = deriveEmbeddingInput({ textFinal: null, textV2: null, textV1: null })

    expect(result).toBeNull()
  })

  it('returns null when every text field is an empty or whitespace-only string', () => {
    const result = deriveEmbeddingInput({ textFinal: '   ', textV2: null, textV1: '' })

    expect(result).toBeNull()
  })

  it('prefers textFinal over textV2 and textV1', () => {
    const result = deriveEmbeddingInput({
      textFinal: 'финальный текст',
      textV2: 'вторая версия',
      textV1: 'первая версия',
    })

    expect(result).not.toBeNull()
    expect(result?.text).toBe('финальный текст')
  })

  it('falls back to textV2 when textFinal is missing', () => {
    const result = deriveEmbeddingInput({ textFinal: null, textV2: 'вторая версия', textV1: 'первая версия' })

    expect(result?.text).toBe('вторая версия')
  })

  it('falls back to textV1 when textFinal and textV2 are missing', () => {
    const result = deriveEmbeddingInput({ textFinal: null, textV2: null, textV1: 'первая версия' })

    expect(result?.text).toBe('первая версия')
  })

  it('produces a stable hash for identical text', () => {
    const a = deriveEmbeddingInput({ textFinal: 'один и тот же текст', textV2: null, textV1: null })
    const b = deriveEmbeddingInput({ textFinal: 'один и тот же текст', textV2: null, textV1: null })

    expect(a?.contentHash).toBe(b?.contentHash)
  })

  it('produces a different hash for different text', () => {
    const a = deriveEmbeddingInput({ textFinal: 'текст один', textV2: null, textV1: null })
    const b = deriveEmbeddingInput({ textFinal: 'текст два', textV2: null, textV1: null })

    expect(a?.contentHash).not.toBe(b?.contentHash)
  })

  it('hashes the trimmed text as a sha256 hex digest', () => {
    const result = deriveEmbeddingInput({ textFinal: '  текст с пробелами  ', textV2: null, textV1: null })
    const expectedHash = createHash('sha256').update('текст с пробелами').digest('hex')

    expect(result?.contentHash).toBe(expectedHash)
    expect(result?.text).toBe('текст с пробелами')
  })
})
