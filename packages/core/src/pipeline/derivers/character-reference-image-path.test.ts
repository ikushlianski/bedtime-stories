import { describe, it, expect } from 'vitest'
import { deriveCharacterReferenceImagePath } from './character-reference-image-path'

describe('deriveCharacterReferenceImagePath', () => {
  it('builds a path from universeId, characterId, uuid and extension only', () => {
    const result = deriveCharacterReferenceImagePath({
      universeId: 7,
      characterId: 42,
      uuid: 'abc-123',
      extension: 'png',
    })

    expect(result).toBe('character-references/universe-7/character-42/abc-123.png')
  })

  it('never derives the path from anything but the given inputs', () => {
    const first = deriveCharacterReferenceImagePath({ universeId: 1, characterId: 1, uuid: 'a', extension: 'jpg' })
    const second = deriveCharacterReferenceImagePath({ universeId: 1, characterId: 1, uuid: 'b', extension: 'jpg' })

    expect(first).not.toBe(second)
  })

  it('produces distinct paths per character within the same universe', () => {
    const first = deriveCharacterReferenceImagePath({ universeId: 7, characterId: 1, uuid: 'a', extension: 'webp' })
    const second = deriveCharacterReferenceImagePath({ universeId: 7, characterId: 2, uuid: 'a', extension: 'webp' })

    expect(first).not.toBe(second)
  })
})
