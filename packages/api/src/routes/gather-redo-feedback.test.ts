import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbState = {
  annotationRows: [] as Array<{ id: number; selectedText: string | null; noteText: string | null }>,
  insertedComment: null as null | Record<string, unknown>,
}

vi.mock('@bedtime/core/db/client', () => {
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve(dbState.annotationRows)),
    })),
  }))

  const insert = vi.fn(() => ({
    values: vi.fn((v: Record<string, unknown>) => {
      dbState.insertedComment = v
      return Promise.resolve()
    }),
  }))

  return { db: { select, insert } }
})

import { gatherRedoFeedback } from './gather-redo-feedback'

describe('gatherRedoFeedback', () => {
  beforeEach(() => {
    dbState.annotationRows = []
    dbState.insertedComment = null
  })

  it('combines a selection-based annotation, a banked whole-story annotation, and the reason into one feedback block', async () => {
    dbState.annotationRows = [
      { id: 1, selectedText: 'дракон зарычал', noteText: 'сделай его добрее' },
      { id: 2, selectedText: null, noteText: 'темп слишком быстрый' },
    ]

    const result = await gatherRedoFeedback({
      storyId: 7,
      context: 'text',
      reason: 'сделай текст короче',
      universeId: 3,
    })

    expect(result.userFeedback).toContain('сделай текст короче')
    expect(result.userFeedback).toContain('дракон зарычал')
    expect(result.userFeedback).toContain('темп слишком быстрый')
    expect(result.annotationRows).toHaveLength(2)
  })

  it('persists the reason as a durable revision_reason comment, not just an in-memory string', async () => {
    await gatherRedoFeedback({
      storyId: 7,
      context: 'plan',
      reason: '  меньше драмы  ',
      universeId: 3,
    })

    expect(dbState.insertedComment).toMatchObject({
      storyId: 7,
      universeId: 3,
      commentText: 'меньше драмы',
      source: 'revision_reason',
    })
  })

  it('does not write a comment row when no reason is given', async () => {
    await gatherRedoFeedback({ storyId: 7, context: 'plan' })

    expect(dbState.insertedComment).toBeNull()
  })

  it('produces an empty feedback string when there is nothing to report', async () => {
    const result = await gatherRedoFeedback({ storyId: 7, context: 'plan' })

    expect(result.userFeedback).toBe('')
  })

  it('skips annotations with no note text', async () => {
    dbState.annotationRows = [{ id: 1, selectedText: 'фрагмент', noteText: null }]

    const result = await gatherRedoFeedback({ storyId: 7, context: 'text', reason: 'причина' })

    expect(result.userFeedback).not.toContain('фрагмент')
    expect(result.userFeedback).toContain('причина')
  })
})
