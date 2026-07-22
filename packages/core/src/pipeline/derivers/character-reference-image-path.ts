export interface DeriveCharacterReferenceImagePathInput {
  universeId: number
  characterId: number
  uuid: string
  extension: string
}

export function deriveCharacterReferenceImagePath(input: DeriveCharacterReferenceImagePathInput): string {
  return `character-references/universe-${input.universeId}/character-${input.characterId}/${input.uuid}.${input.extension}`
}
