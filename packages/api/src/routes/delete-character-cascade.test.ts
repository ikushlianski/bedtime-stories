import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbState = {
  deletedTables: [] as string[],
}

function tableName(t: unknown): string {
  if (typeof t !== 'object' || t === null) return ''
  const sym = Object.getOwnPropertySymbols(t).find((s) => s.toString() === 'Symbol(drizzle:OriginalName)')
  return sym ? String((t as Record<symbol, unknown>)[sym]) : ''
}

vi.mock('@bedtime/core/db/client', () => {
  const del = vi.fn((tbl: unknown) => {
    dbState.deletedTables.push(tableName(tbl))
    return { where: vi.fn(() => Promise.resolve()) }
  })

  return { db: { delete: del } }
})

import { deleteCharacterCascade } from './delete-character-cascade'

describe('deleteCharacterCascade', () => {
  beforeEach(() => {
    dbState.deletedTables = []
  })

  it('deletes reference images, portraits, and cost rows before the character row itself', async () => {
    await deleteCharacterCascade(42)

    const expectedChildTables = ['character_reference_images', 'character_portraits', 'model_calls']

    for (const table of expectedChildTables) {
      expect(dbState.deletedTables).toContain(table)
    }

    expect(dbState.deletedTables[dbState.deletedTables.length - 1]).toBe('universe_characters')
    expect(dbState.deletedTables.indexOf('universe_characters')).toBe(dbState.deletedTables.length - 1)
  })
})
