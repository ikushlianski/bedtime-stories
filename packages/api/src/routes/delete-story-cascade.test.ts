import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbState = {
  deletedTables: [] as string[],
  updatedTables: [] as string[],
  executedSql: [] as unknown[],
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

  const update = vi.fn((tbl: unknown) => ({
    set: vi.fn(() => {
      dbState.updatedTables.push(tableName(tbl))
      return { where: vi.fn(() => Promise.resolve()) }
    }),
  }))

  const execute = vi.fn((query: unknown) => {
    dbState.executedSql.push(query)
    return Promise.resolve()
  })

  return { db: { delete: del, update, execute } }
})

import { deleteStoryCascade } from './delete-story-cascade'

describe('deleteStoryCascade', () => {
  beforeEach(() => {
    dbState.deletedTables = []
    dbState.updatedTables = []
    dbState.executedSql = []
  })

  it('deletes from every table with a foreign key to stories, ending with stories itself', async () => {
    await deleteStoryCascade(129)

    const expectedChildTables = [
      'annotations',
      'run_snapshots',
      'feedback',
      'plan_questions',
      'plan_conversations',
      'story_readings',
      'model_calls',
      'model_swap_events',
      'value_for_money_feedback',
      'story_comments',
      'parent_reviews',
      'child_reactions',
      'story_fragments',
      'story_words',
      'story_topics',
      'story_text_versions',
      'story_embeddings',
      'story_universes',
    ]

    for (const table of expectedChildTables) {
      expect(dbState.deletedTables).toContain(table)
    }

    expect(dbState.deletedTables[dbState.deletedTables.length - 1]).toBe('stories')
    expect(dbState.deletedTables.indexOf('stories')).toBe(dbState.deletedTables.length - 1)
  })

  it('nulls out universe_suggestions.source_story_id instead of deleting the suggestion', async () => {
    await deleteStoryCascade(129)

    expect(dbState.updatedTables).toContain('universe_suggestions')
    expect(dbState.deletedTables).not.toContain('universe_suggestions')
  })

  it('removes character_memories rows via raw sql (table not in this branch of the drizzle schema)', async () => {
    await deleteStoryCascade(129)

    expect(dbState.executedSql).toHaveLength(1)
  })
})
