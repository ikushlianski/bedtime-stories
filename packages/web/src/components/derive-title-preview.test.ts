import { describe, expect, it } from 'vitest'
import { deriveTitlePreview } from './derive-title-preview'

describe('deriveTitlePreview', () => {
  it('returns the first sentence as-is when it fits within maxLength', () => {
    const seed = 'A dragon loses his fire. Then he finds a way to get it back.'

    expect(deriveTitlePreview(seed, 100)).toBe('A dragon loses his fire.')
  })

  it('returns the whole trimmed seed when it has no sentence-ending punctuation and fits', () => {
    const seed = 'A story about a dragon who loses his fire'

    expect(deriveTitlePreview(seed, 100)).toBe('A story about a dragon who loses his fire')
  })

  it('hard-truncates at a word boundary and appends an ellipsis when the first sentence exceeds maxLength', () => {
    const seed =
      'A dragon who has lost his fire wanders through an enchanted forest looking for a way to get it back before winter arrives.'

    const preview = deriveTitlePreview(seed, 40)

    expect(preview.endsWith('…')).toBe(true)
    expect(preview.length).toBeLessThanOrEqual(41)
    expect(preview).toBe('A dragon who has lost his fire wanders…')
  })

  it('hard-truncates a single unbroken word when there is no earlier word boundary', () => {
    const seed = 'Supercalifragilisticexpialidocious'.repeat(3)

    const preview = deriveTitlePreview(seed, 10)

    expect(preview).toBe(`${seed.slice(0, 10)}…`)
  })

  it('returns an empty string for an empty seed', () => {
    expect(deriveTitlePreview('', 100)).toBe('')
  })

  it('returns an empty string for a whitespace-only seed', () => {
    expect(deriveTitlePreview('   \n\t  ', 100)).toBe('')
  })
})
