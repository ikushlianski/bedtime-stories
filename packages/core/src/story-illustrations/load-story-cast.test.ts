import { describe, it, expect, vi, beforeEach } from 'vitest'

let selectQueue: unknown[][] = []
let selectCallIndex = 0

function makeSelectBuilder(rows: unknown[]) {
  const builder = {
    from: () => builder,
    where: () => builder,
    then: (resolve: (rows: unknown[]) => void) => resolve(rows),
  }
  return builder
}

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(() => makeSelectBuilder(selectQueue[selectCallIndex++] ?? [])),
  },
}))

vi.mock('../character-portraits/load-characters-with-portrait.js', () => ({
  loadCharactersWithPortrait: vi.fn(),
}))

import { loadStoryCast } from './load-story-cast'
import { loadCharactersWithPortrait } from '../character-portraits/load-characters-with-portrait.js'

describe('loadStoryCast', () => {
  beforeEach(() => {
    selectQueue = []
    selectCallIndex = 0
    vi.mocked(loadCharactersWithPortrait).mockReset()
  })

  it('falls back to the story groupId when it has no explicit universe links', async () => {
    selectQueue = [[{ groupId: 10 }], []]
    vi.mocked(loadCharactersWithPortrait).mockResolvedValueOnce([
      { id: 1, universeId: 10, name: 'Гоша', currentPortrait: null } as never,
    ])

    const result = await loadStoryCast(1)

    expect(loadCharactersWithPortrait).toHaveBeenCalledWith(10)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('Гоша')
  })

  it('merges cast across every linked universe, deduped by character id', async () => {
    selectQueue = [[{ groupId: null }], [{ universeId: 10 }, { universeId: 20 }]]
    vi.mocked(loadCharactersWithPortrait).mockImplementation(async (universeId: number) => {
      if (universeId === 10) {
        return [
          { id: 1, universeId: 10, name: 'Гоша', currentPortrait: null } as never,
          { id: 2, universeId: 10, name: 'Лиса Соня', currentPortrait: null } as never,
        ]
      }
      return [{ id: 2, universeId: 20, name: 'Лиса Соня (duplicate)', currentPortrait: null } as never]
    })

    const result = await loadStoryCast(2)

    expect(result).toHaveLength(2)
    const soniaEntry = result.find((c) => c.id === 2)
    expect(soniaEntry?.name).toBe('Лиса Соня')
  })

  it('returns an empty list when the story has no universe at all', async () => {
    selectQueue = [[{ groupId: null }], []]

    const result = await loadStoryCast(3)

    expect(result).toEqual([])
    expect(loadCharactersWithPortrait).not.toHaveBeenCalled()
  })
})
