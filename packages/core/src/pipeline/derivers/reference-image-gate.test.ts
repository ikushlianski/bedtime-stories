import { describe, it, expect } from 'vitest'
import { deriveReferenceImageGate } from './reference-image-gate'

describe('deriveReferenceImageGate', () => {
  it('passes when the scene names no characters', () => {
    const result = deriveReferenceImageGate({ charactersPresent: [], referenceableCharacterNames: [] })

    expect(result).toEqual({ ok: true, missingCharacterNames: [] })
  })

  it('passes when every named character has a reference image', () => {
    const result = deriveReferenceImageGate({
      charactersPresent: ['Гоша', 'Мила'],
      referenceableCharacterNames: ['Гоша', 'Мила', 'Барсук'],
    })

    expect(result).toEqual({ ok: true, missingCharacterNames: [] })
  })

  it('matches names normalized by case and whitespace', () => {
    const result = deriveReferenceImageGate({
      charactersPresent: [' гоша '],
      referenceableCharacterNames: ['Гоша'],
    })

    expect(result).toEqual({ ok: true, missingCharacterNames: [] })
  })

  it('fails and lists the single missing character', () => {
    const result = deriveReferenceImageGate({
      charactersPresent: ['Гоша'],
      referenceableCharacterNames: [],
    })

    expect(result).toEqual({ ok: false, missingCharacterNames: ['Гоша'] })
  })

  it('fails a scene naming multiple characters when only some have references', () => {
    const result = deriveReferenceImageGate({
      charactersPresent: ['Гоша', 'Мила'],
      referenceableCharacterNames: ['Гоша'],
    })

    expect(result).toEqual({ ok: false, missingCharacterNames: ['Мила'] })
  })

  it('lists all missing characters, comma-joinable by the caller', () => {
    const result = deriveReferenceImageGate({
      charactersPresent: ['Гоша', 'Мила', 'Барсук'],
      referenceableCharacterNames: [],
    })

    expect(result).toEqual({ ok: false, missingCharacterNames: ['Гоша', 'Мила', 'Барсук'] })
  })
})
