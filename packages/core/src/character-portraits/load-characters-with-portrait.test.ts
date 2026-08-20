import { describe, it, expect, vi, beforeEach } from 'vitest'

let rowsQueue: unknown[][] = []
let callIndex = 0

function makeQueryBuilder(rows: unknown[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    then: (resolve: (rows: unknown[]) => void) => resolve(rows),
  }
  return builder
}

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(() => makeQueryBuilder(rowsQueue[callIndex++] ?? [])),
  },
}))

import { loadCharactersWithPortrait } from './load-characters-with-portrait'

describe('loadCharactersWithPortrait', () => {
  beforeEach(() => {
    rowsQueue = []
    callIndex = 0
  })

  it('returns an empty list untouched when the universe has no characters', async () => {
    rowsQueue = [[]]

    const result = await loadCharactersWithPortrait(10)

    expect(result).toEqual([])
  })

  it('attaches null currentPortrait for a character with none', async () => {
    rowsQueue = [[{ id: 1, universeId: 10, name: 'Gosha' }], []]

    const result = await loadCharactersWithPortrait(10)

    expect(result).toEqual([{ id: 1, universeId: 10, name: 'Gosha', currentPortrait: null }])
  })

  it('attaches the matching current portrait for each character', async () => {
    rowsQueue = [
      [{ id: 1, universeId: 10, name: 'Gosha' }, { id: 2, universeId: 10, name: 'Masha' }],
      [{ characterId: 1, storagePath: 'portraits/1/a.png', tier: 'own_reference', generatedAt: new Date(1000) }],
    ]

    const result = await loadCharactersWithPortrait(10)

    expect(result.find((c) => c.id === 1)?.currentPortrait).toEqual({
      storagePath: 'portraits/1/a.png',
      tier: 'own_reference',
      generatedAt: new Date(1000),
    })
    expect(result.find((c) => c.id === 2)?.currentPortrait).toBeNull()
  })

  it('picks the most recently generated row when more than one is flagged current for the same character', async () => {
    rowsQueue = [
      [{ id: 1, universeId: 10, name: 'Gosha' }],
      [
        { characterId: 1, storagePath: 'portraits/1/old.png', tier: 'default_style', generatedAt: new Date(1000) },
        { characterId: 1, storagePath: 'portraits/1/new.png', tier: 'own_reference', generatedAt: new Date(5000) },
      ],
    ]

    const result = await loadCharactersWithPortrait(10)

    expect(result[0]?.currentPortrait?.storagePath).toBe('portraits/1/new.png')
  })
})
