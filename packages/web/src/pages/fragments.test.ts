import { describe, it, expect } from 'vitest'
import type { StoryGroup } from '../lib/api'
import { universeName } from './fragments'

const universes = [
  { id: 1, name: 'Книга Гоши' },
  { id: 2, name: 'Космос' },
] as StoryGroup[]

describe('universeName', () => {
  it('labels an untagged fragment as eligible everywhere', () => {
    expect(universeName(universes, null)).toBe('Все вселенные')
  })

  it('resolves a tagged fragment to its universe name', () => {
    expect(universeName(universes, 2)).toBe('Космос')
  })

  it('falls back to the id when the universe is unknown', () => {
    expect(universeName(universes, 99)).toBe('Вселенная #99')
  })
})
