import { describe, it, expect } from 'vitest'
import { deriveIllustrationPrompt } from './illustration-prompt'

describe('deriveIllustrationPrompt', () => {
  it('includes only the scene description when style guide and character descriptions are absent', () => {
    const result = deriveIllustrationPrompt({
      sceneDescription: 'A fox reads a book under a tree.',
      visualStyleGuide: null,
      characters: [],
    })

    expect(result).toBe('A fox reads a book under a tree.')
  })

  it('appends the visual style guide when present', () => {
    const result = deriveIllustrationPrompt({
      sceneDescription: 'A fox reads a book under a tree.',
      visualStyleGuide: 'Warm watercolor palette, soft outlines',
      characters: [],
    })

    expect(result).toContain('A fox reads a book under a tree.')
    expect(result).toContain('Visual style: Warm watercolor palette, soft outlines')
  })

  it('lists characters that have a visual description', () => {
    const result = deriveIllustrationPrompt({
      sceneDescription: 'Two friends meet in the forest.',
      visualStyleGuide: null,
      characters: [
        { name: 'Gosha', visualDescription: 'Small brown bear with a red scarf' },
        { name: 'Sasha', visualDescription: null },
      ],
    })

    expect(result).toContain('Characters in this scene:')
    expect(result).toContain('- Gosha: Small brown bear with a red scarf')
    expect(result).not.toContain('Sasha')
  })

  it('omits the characters block entirely when none have a visual description', () => {
    const result = deriveIllustrationPrompt({
      sceneDescription: 'Two friends meet in the forest.',
      visualStyleGuide: null,
      characters: [{ name: 'Sasha', visualDescription: null }],
    })

    expect(result).not.toContain('Characters in this scene:')
  })

  it('combines all three sections in order', () => {
    const result = deriveIllustrationPrompt({
      sceneDescription: 'The final celebration scene.',
      visualStyleGuide: 'Bright colors',
      characters: [{ name: 'Gosha', visualDescription: 'Brown bear' }],
    })

    const sceneIdx = result.indexOf('The final celebration scene.')
    const styleIdx = result.indexOf('Visual style:')
    const charIdx = result.indexOf('Characters in this scene:')

    expect(sceneIdx).toBeLessThan(styleIdx)
    expect(styleIdx).toBeLessThan(charIdx)
  })
})
