import type { PortraitTier } from './derive-reference-tier.js'

export interface BuildPortraitPromptCharacter {
  name: string
  description: string
  age: string | null
  traits: string | null
}

const COMMON_INSTRUCTIONS =
  'Show a single character alone, in a clean portrait/headshot presentation — head and shoulders, ' +
  'plain or softly blurred background, no other characters, no scene, no background action.'

function characterDescriptionBlock(character: BuildPortraitPromptCharacter): string {
  const lines = [`Character name: ${character.name}`]

  if (character.description.trim()) lines.push(`Description: ${character.description.trim()}`)
  if (character.age?.trim()) lines.push(`Age: ${character.age.trim()}`)
  if (character.traits?.trim()) lines.push(`Traits: ${character.traits.trim()}`)

  return lines.join('\n')
}

export function buildPortraitPrompt(character: BuildPortraitPromptCharacter, tier: PortraitTier): string {
  const description = characterDescriptionBlock(character)

  if (tier === 'own_reference') {
    return [
      'Generate a portrait of this character using the attached reference image(s) as the source of truth for their appearance.',
      'Match the character\'s face, body, and outfit as closely as possible to the reference images provided.',
      description,
      COMMON_INSTRUCTIONS,
    ].join('\n\n')
  }

  const styleSourceLabel =
    tier === 'universe_sibling'
      ? 'the attached reference image(s) of other characters from the same story universe'
      : 'the attached reference image'

  return [
    `Invent this character's own appearance from the description below — do not copy the identity, face, or outfit shown in ${styleSourceLabel}.`,
    `Only match the art style (linework, coloring, rendering technique) of ${styleSourceLabel}.`,
    description,
    COMMON_INSTRUCTIONS,
  ].join('\n\n')
}
