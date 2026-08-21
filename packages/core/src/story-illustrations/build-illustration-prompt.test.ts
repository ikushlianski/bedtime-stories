import { describe, it, expect } from 'vitest'
import { buildIllustrationPrompt } from './build-illustration-prompt'

const gosha = { name: 'Гоша', description: 'Любопытный лисёнок', age: '7', traits: 'смелый' }
const sonya = { name: 'Лиса Соня', description: 'Мудрая старая лиса', age: null, traits: null }

describe('buildIllustrationPrompt', () => {
  it('states the scene directly for a scene_description moment', () => {
    const prompt = buildIllustrationPrompt(
      { kind: 'scene_description', text: 'Гоша смотрит на звёзды у реки.' },
      [],
      0,
    )

    expect(prompt).toContain('Гоша смотрит на звёзды у реки.')
    expect(prompt).not.toMatch(/verbatim quote/i)
  })

  it('frames a story_excerpt as a verbatim quote and instructs against rendering it as text-in-image', () => {
    const prompt = buildIllustrationPrompt(
      { kind: 'story_excerpt', text: '"Смотри!" — закричал Гоша.' },
      [],
      0,
    )

    expect(prompt).toMatch(/verbatim quote/i)
    expect(prompt).toContain('"Смотри!" — закричал Гоша.')
    expect(prompt).toMatch(/not.*text-in-image/i)
  })

  it('lists identity-only reference images in order for characters that have one', () => {
    const prompt = buildIllustrationPrompt(
      { kind: 'scene_description', text: 'Сцена в лесу.' },
      [
        { ...gosha, hasIdentityReference: true },
        { ...sonya, hasIdentityReference: true },
      ],
      2,
    )

    expect(prompt).toMatch(/first attached reference image.*Гоша/is)
    expect(prompt).toMatch(/second attached reference image.*Лиса Соня/is)
    expect(prompt).toMatch(/identity only/i)
  })

  it('states the final attached image is the sole style anchor', () => {
    const prompt = buildIllustrationPrompt(
      { kind: 'scene_description', text: 'Сцена в лесу.' },
      [{ ...gosha, hasIdentityReference: true }],
      1,
    )

    expect(prompt).toMatch(/final attached image/i)
    expect(prompt).toMatch(/style anchor/i)
  })

  it('instructs inventing appearance from bible fields for a character with no identity reference', () => {
    const prompt = buildIllustrationPrompt(
      { kind: 'scene_description', text: 'Сцена в лесу.' },
      [{ ...sonya, hasIdentityReference: false }],
      0,
    )

    expect(prompt).toMatch(/invent/i)
    expect(prompt).toMatch(/Лиса Соня/)
    expect(prompt).toMatch(/Мудрая старая лиса/)
  })

  it('never invents a face for a character who does have an identity reference', () => {
    const prompt = buildIllustrationPrompt(
      { kind: 'scene_description', text: 'Сцена в лесу.' },
      [{ ...gosha, hasIdentityReference: true }],
      1,
    )

    expect(prompt).not.toMatch(/invent Гоша/i)
  })

  it('includes bible fields for every character in the moment regardless of identity-reference status', () => {
    const prompt = buildIllustrationPrompt(
      { kind: 'scene_description', text: 'Сцена в лесу.' },
      [
        { ...gosha, hasIdentityReference: true },
        { ...sonya, hasIdentityReference: false },
      ],
      1,
    )

    expect(prompt).toContain('Гоша')
    expect(prompt).toContain('смелый')
    expect(prompt).toContain('Лиса Соня')
    expect(prompt).toContain('Мудрая старая лиса')
  })

  it('handles a moment with no characters at all', () => {
    const prompt = buildIllustrationPrompt({ kind: 'scene_description', text: 'Пустой пейзаж на рассвете.' }, [], 0)

    expect(prompt).toContain('Пустой пейзаж на рассвете.')
    expect(prompt).toMatch(/style anchor/i)
  })
})
