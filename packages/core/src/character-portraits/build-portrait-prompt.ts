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

export function buildPortraitPrompt(
  character: BuildPortraitPromptCharacter,
  tier: PortraitTier,
  identityReferenceCount = 0,
): string {
  const description = characterDescriptionBlock(character)

  if (tier === 'own_reference') {
    const identityLabel = identityReferenceCount === 1 ? 'The first attached reference image shows' : `The first ${identityReferenceCount} attached reference images show`

    return [
      `${identityLabel} this character's real appearance — match their face, body, and outfit as closely as possible. Take identity ONLY from ${identityReferenceCount === 1 ? 'this image' : 'these images'}, never style.`,
      'The final attached reference image is a separate style guide only — match its art style (linework, coloring, rendering technique) exactly. Do not copy its subject, scene, or content, and ignore whatever style the identity reference(s) above happen to be in (e.g. a real photo) — the final image\'s style always wins.',
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
