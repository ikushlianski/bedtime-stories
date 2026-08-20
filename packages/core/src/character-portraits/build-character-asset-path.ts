export interface BuildCharacterAssetPathInput {
  kind: 'reference' | 'portrait'
  characterId: number
  fileId: string
  extension: string
}

const PREFIX_BY_KIND: Record<BuildCharacterAssetPathInput['kind'], string> = {
  reference: 'references',
  portrait: 'portraits',
}

export function buildCharacterAssetPath(input: BuildCharacterAssetPathInput): string {
  const prefix = PREFIX_BY_KIND[input.kind]
  const extension = input.extension.replace(/^\./, '')

  return `${prefix}/${input.characterId}/${input.fileId}.${extension}`
}
