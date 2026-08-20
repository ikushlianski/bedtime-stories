import { describe, it, expect, vi, beforeEach } from 'vitest'

let rowsQueue: unknown[][] = []
let callIndex = 0
const whereCalls: unknown[] = []

function makeQueryBuilder(rows: unknown[]) {
  const builder = {
    from: () => builder,
    innerJoin: () => builder,
    where: (...args: unknown[]) => {
      whereCalls.push(args[0])
      return builder
    },
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (rows: unknown[]) => void) => resolve(rows),
  }
  return builder
}

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn(() => makeQueryBuilder(rowsQueue[callIndex++] ?? [])),
  },
}))

import { loadPortraitCandidates } from './load-portrait-candidates'

describe('loadPortraitCandidates', () => {
  beforeEach(() => {
    rowsQueue = []
    callIndex = 0
    whereCalls.length = 0
  })

  it('returns own reference storage paths and sibling portrait storage paths', async () => {
    rowsQueue = [
      [{ storagePath: 'references/1/a.png' }, { storagePath: 'references/1/b.png' }],
      [{ storagePath: 'portraits/2/c.png' }],
    ]

    const result = await loadPortraitCandidates({ characterId: 1, universeId: 10 })

    expect(result).toEqual({
      ownReferenceValues: ['references/1/a.png', 'references/1/b.png'],
      siblingPortraitValues: ['portraits/2/c.png'],
    })
  })

  it('returns empty arrays when the character has no references and the universe has no other portraits', async () => {
    rowsQueue = [[], []]

    const result = await loadPortraitCandidates({ characterId: 1, universeId: 10 })

    expect(result).toEqual({ ownReferenceValues: [], siblingPortraitValues: [] })
  })

  it('excludes the character being generated from its own sibling query with a not-equal filter', async () => {
    rowsQueue = [[], []]

    await loadPortraitCandidates({ characterId: 99, universeId: 10 })

    const siblingWhereClause = whereCalls[1]
    const seen = new WeakSet()
    const serialized = JSON.stringify(siblingWhereClause, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return undefined
        seen.add(value)
      }
      return value
    })

    expect(serialized).toContain(' <> ')
    expect(serialized).toContain('99')
  })
})
