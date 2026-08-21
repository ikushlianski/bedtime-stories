export interface DetectCastMembersInTextInput {
  text: string
  cast: Array<{ id: number; name: string }>
}

export interface DetectCastMembersInTextResult {
  matchedCharacterIds: number[]
}

export function detectCastMembersInText(input: DetectCastMembersInTextInput): DetectCastMembersInTextResult {
  const lowerText = input.text.toLowerCase()

  const matchedCharacterIds = input.cast
    .filter((character) => lowerText.includes(character.name.trim().toLowerCase()))
    .map((character) => character.id)

  return { matchedCharacterIds }
}
