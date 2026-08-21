export interface BuildIllustrationPromptMoment {
  kind: 'scene_description' | 'story_excerpt'
  text: string
}

export interface BuildIllustrationPromptCharacter {
  name: string
  description: string
  age: string | null
  traits: string | null
  hasIdentityReference: boolean
}

const ORDINALS = ['first', 'second', 'third']

function ordinalFor(index: number): string {
  return ORDINALS[index] ?? `${index + 1}th`
}

function characterDescriptionBlock(character: BuildIllustrationPromptCharacter): string {
  const lines = [`Character name: ${character.name}`]

  if (character.description.trim()) lines.push(`Description: ${character.description.trim()}`)
  if (character.age?.trim()) lines.push(`Age: ${character.age.trim()}`)
  if (character.traits?.trim()) lines.push(`Traits: ${character.traits.trim()}`)

  return lines.join('\n')
}

function sceneBlock(moment: BuildIllustrationPromptMoment): string {
  if (moment.kind === 'story_excerpt') {
    return [
      `The following is a VERBATIM QUOTE from the story: "${moment.text}"`,
      'Illustrate the scene this quote depicts. Do not render any of this quoted text as literal text-in-image — draw the scene it describes, not the words themselves.',
    ].join('\n')
  }

  return `Illustrate the following scene from a children's bedtime story:\n\n${moment.text}`
}

export function buildIllustrationPrompt(
  moment: BuildIllustrationPromptMoment,
  charactersInMoment: BuildIllustrationPromptCharacter[],
  identityReferenceCount = 0,
): string {
  const identityCharacters = charactersInMoment.filter((c) => c.hasIdentityReference).slice(0, identityReferenceCount)
  const inventCharacters = charactersInMoment.filter((c) => !c.hasIdentityReference)

  const parts: string[] = [sceneBlock(moment)]

  if (identityCharacters.length > 0) {
    const identityLines = identityCharacters.map((character, index) => {
      const ordinal = ordinalFor(index)
      return `The ${ordinal} attached reference image shows ${character.name}'s established appearance — match their face, body, and outfit as closely as possible. Take identity only from this image, never style.`
    })

    parts.push(identityLines.join('\n'))
  }

  parts.push(
    'The final attached image is the sole style anchor for this picture — match its art style (linework, coloring, rendering technique) exactly. Do not copy its subject or scene.',
  )

  if (inventCharacters.length > 0) {
    const inventLines = inventCharacters.map(
      (character) =>
        `Invent ${character.name}'s appearance from their description below, consistent with the shared art style — do not copy the face or outfit of any character shown in an identity reference image above.`,
    )

    parts.push(inventLines.join('\n'))
  }

  const allDescriptions = charactersInMoment.map(characterDescriptionBlock).join('\n\n')
  if (allDescriptions) parts.push(allDescriptions)

  parts.push(
    "Picture-book illustration style suitable for a children's bedtime story — warm, gentle, appropriate for a young child. Depict the full scene, not an isolated portrait.",
  )

  return parts.join('\n\n')
}
