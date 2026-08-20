export type PortraitTier = 'own_reference' | 'universe_sibling' | 'default_style'

export interface DeriveReferenceTierInput {
  ownReferenceValues: string[]
  siblingPortraitValues: string[]
}

export interface DeriveReferenceTierResult {
  tier: PortraitTier
  referenceValues: string[]
}

export const MAX_SIBLING_PORTRAITS = 3

export function deriveReferenceTier(input: DeriveReferenceTierInput): DeriveReferenceTierResult {
  if (input.ownReferenceValues.length > 0) {
    return { tier: 'own_reference', referenceValues: input.ownReferenceValues }
  }

  if (input.siblingPortraitValues.length > 0) {
    return { tier: 'universe_sibling', referenceValues: input.siblingPortraitValues.slice(0, MAX_SIBLING_PORTRAITS) }
  }

  return { tier: 'default_style', referenceValues: [] }
}
