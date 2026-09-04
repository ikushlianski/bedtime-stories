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

  if (tier === 'universe_sibling') {
    const identityLabel = 'the attached reference image(s) of other characters from the same story universe'

    return [
      `This is a DIFFERENT, unrelated character from anyone shown in ${identityLabel} — even though reference image(s) are attached, they depict a completely different individual, not this one.`,
      `Invent this character's own appearance from the description below. Give them their own distinct hair color and style, face shape, expression, and outfit — do not copy the face, hairstyle, or outfit shown in ${identityLabel}. Take identity ONLY from what those images rule OUT, never style.`,
      `If the description below is sparse or does not specify appearance details, invent plausible, distinct ones yourself (consistent with the name/age/traits given) rather than defaulting to what's shown in ${identityLabel} — a thin description is never a reason to reuse someone else's face.`,
      'The final attached reference image is a separate style guide only — match its art style (linework, coloring, rendering technique) exactly. Ignore whatever style the other character reference(s) above happen to be in — the final image\'s style always wins, so this character\'s look stays visually consistent with the rest of the universe instead of drifting from character to character.',
      description,
      COMMON_INSTRUCTIONS,
    ].join('\n\n')
  }

  const styleSourceLabel = 'the attached reference image'

  return [
    `This is a DIFFERENT, unrelated character from anyone shown in ${styleSourceLabel} — even though a reference image is attached, it depicts a completely different individual, not this one.`,
    `Invent this character's own appearance from the description below. Give them their own distinct hair color and style, face shape, expression, and outfit — do not copy the face, hairstyle, or outfit shown in ${styleSourceLabel}.`,
    `If the description below is sparse or does not specify appearance details, invent plausible, distinct ones yourself (consistent with the name/age/traits given) rather than defaulting to what's shown in ${styleSourceLabel} — a thin description is never a reason to reuse someone else's face.`,
    `Only match the art style (linework, coloring, rendering technique) of ${styleSourceLabel}.`,
    description,
    COMMON_INSTRUCTIONS,
  ].join('\n\n')
}
