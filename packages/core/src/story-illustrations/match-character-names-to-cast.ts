export interface MatchCharacterNamesToCastInput {
  characterNames: string[]
  cast: Array<{ id: number; name: string }>
}

export interface MatchCharacterNamesToCastResult {
  matchedCharacterIds: number[]
  unmatchedNames: string[]
}

export function matchCharacterNamesToCast(input: MatchCharacterNamesToCastInput): MatchCharacterNamesToCastResult {
  const castByNormalizedName = new Map(input.cast.map((c) => [c.name.trim().toLowerCase(), c.id]))

  const matchedCharacterIds: number[] = []
  const unmatchedNames: string[] = []

  for (const name of input.characterNames) {
    const matchedId = castByNormalizedName.get(name.trim().toLowerCase())

    if (matchedId !== undefined) {
      matchedCharacterIds.push(matchedId)
    } else {
      unmatchedNames.push(name)
    }
  }

  return { matchedCharacterIds, unmatchedNames }
}
