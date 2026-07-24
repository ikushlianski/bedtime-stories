export interface IllustrationPromptCharacter {
  name: string
  visualDescription: string | null
}

export interface DeriveIllustrationPromptInput {
  sceneDescription: string
  visualStyleGuide: string | null
  characters: IllustrationPromptCharacter[]
}

export function deriveIllustrationPrompt(input: DeriveIllustrationPromptInput): string {
  const parts: string[] = [input.sceneDescription.trim()]

  if (input.visualStyleGuide && input.visualStyleGuide.trim()) {
    parts.push(`Visual style: ${input.visualStyleGuide.trim()}`)
  }

  const describedCharacters = input.characters.filter(
    (c) => c.visualDescription !== null && c.visualDescription.trim() !== '',
  )

  if (describedCharacters.length > 0) {
    const characterLines = describedCharacters
      .map((c) => `- ${c.name}: ${(c.visualDescription as string).trim()}`)
      .join('\n')

    parts.push(`Characters in this scene:\n${characterLines}`)
  }

  return parts.join('\n\n')
}
