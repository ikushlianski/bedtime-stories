export function normalizeCharacterName(name: string): string {
  return name.trim().toLowerCase()
}

export function charactersMatch(a: string, b: string): boolean {
  return normalizeCharacterName(a) === normalizeCharacterName(b)
}
