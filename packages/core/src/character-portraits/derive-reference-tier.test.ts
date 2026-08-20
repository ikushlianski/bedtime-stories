import { describe, it, expect } from 'vitest'
import { deriveReferenceTier } from './derive-reference-tier'

describe('deriveReferenceTier', () => {
  it('uses own_reference tier and every own reference when the character has any', () => {
    const result = deriveReferenceTier({
      ownReferenceValues: ['ref-1', 'ref-2', 'ref-3', 'ref-4', 'ref-5'],
      siblingPortraitValues: ['sib-1'],
    })

    expect(result).toEqual({ tier: 'own_reference', referenceValues: ['ref-1', 'ref-2', 'ref-3', 'ref-4', 'ref-5'] })
  })

  it('falls back to universe_sibling when there are no own references but siblings exist', () => {
    const result = deriveReferenceTier({
      ownReferenceValues: [],
      siblingPortraitValues: ['sib-1', 'sib-2'],
    })

    expect(result).toEqual({ tier: 'universe_sibling', referenceValues: ['sib-1', 'sib-2'] })
  })

  it('caps sibling references at 3 even when more are available', () => {
    const result = deriveReferenceTier({
      ownReferenceValues: [],
      siblingPortraitValues: ['sib-1', 'sib-2', 'sib-3', 'sib-4', 'sib-5'],
    })

    expect(result.tier).toBe('universe_sibling')
    expect(result.referenceValues).toEqual(['sib-1', 'sib-2', 'sib-3'])
  })

  it('falls back to default_style when there are no own references and no siblings', () => {
    const result = deriveReferenceTier({ ownReferenceValues: [], siblingPortraitValues: [] })

    expect(result).toEqual({ tier: 'default_style', referenceValues: [] })
  })

  it('prefers own references over siblings even when both are available', () => {
    const result = deriveReferenceTier({ ownReferenceValues: ['ref-1'], siblingPortraitValues: ['sib-1', 'sib-2'] })

    expect(result.tier).toBe('own_reference')
  })
})
