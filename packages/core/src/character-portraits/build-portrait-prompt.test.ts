import { describe, it, expect } from 'vitest'
import { buildPortraitPrompt } from './build-portrait-prompt'

const character = {
  name: 'Gosha',
  description: 'A curious young fox who loves stargazing.',
  age: '7',
  traits: 'brave, kind, easily distracted',
}

describe('buildPortraitPrompt', () => {
  it('asks the model to match the uploaded appearance for the own_reference tier', () => {
    const prompt = buildPortraitPrompt(character, 'own_reference')

    expect(prompt).toMatch(/reference image/i)
    expect(prompt).toMatch(/match/i)
    expect(prompt).not.toMatch(/invent/i)
  })

  it('asks the model to invent the appearance and match only style for the universe_sibling tier', () => {
    const prompt = buildPortraitPrompt(character, 'universe_sibling')

    expect(prompt).toMatch(/invent/i)
    expect(prompt).toMatch(/art style/i)
    expect(prompt).toMatch(/do not copy the identity/i)
  })

  it('asks the model to invent the appearance and match only style for the default_style tier', () => {
    const prompt = buildPortraitPrompt(character, 'default_style')

    expect(prompt).toMatch(/invent/i)
    expect(prompt).toMatch(/art style/i)
  })

  it('always states single character, no scene, portrait/headshot presentation', () => {
    for (const tier of ['own_reference', 'universe_sibling', 'default_style'] as const) {
      const prompt = buildPortraitPrompt(character, tier)

      expect(prompt).toMatch(/single character/i)
      expect(prompt).toMatch(/no scene/i)
      expect(prompt).toMatch(/portrait\/headshot/i)
    }
  })

  it('includes the character bible fields in the prompt', () => {
    const prompt = buildPortraitPrompt(character, 'own_reference')

    expect(prompt).toContain('Gosha')
    expect(prompt).toContain('curious young fox')
    expect(prompt).toContain('7')
    expect(prompt).toContain('brave, kind, easily distracted')
  })

  it('omits empty bible fields rather than printing blank lines', () => {
    const prompt = buildPortraitPrompt({ name: 'Nameless', description: '', age: null, traits: null }, 'default_style')

    expect(prompt).not.toMatch(/Description: *\n/)
    expect(prompt).not.toMatch(/Age: *\n/)
    expect(prompt).not.toMatch(/Traits: *\n/)
  })
})
