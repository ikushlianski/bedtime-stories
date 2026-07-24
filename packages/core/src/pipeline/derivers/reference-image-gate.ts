import { charactersMatch } from './character-name-match'

export interface DeriveReferenceImageGateInput {
  charactersPresent: string[]
  referenceableCharacterNames: string[]
}

export interface ReferenceImageGateDecision {
  ok: boolean
  missingCharacterNames: string[]
}

export function deriveReferenceImageGate(input: DeriveReferenceImageGateInput): ReferenceImageGateDecision {
  const missingCharacterNames = input.charactersPresent.filter(
    (name) => !input.referenceableCharacterNames.some((referenceable) => charactersMatch(name, referenceable)),
  )

  return {
    ok: missingCharacterNames.length === 0,
    missingCharacterNames,
  }
}
