import { describe, it, expect, vi, beforeEach } from 'vitest'

function tableName(t: unknown): string {
  if (typeof t !== 'object' || t === null) return ''
  const sym = Object.getOwnPropertySymbols(t).find((s) => s.toString() === 'Symbol(drizzle:OriginalName)')
  return sym ? String((t as Record<symbol, unknown>)[sym]) : ''
}

const dbState = {
  annotationRows: [] as Array<{ id: number; selectedText: string | null; noteText: string | null }>,
  bankedComments: [] as Array<{ id: number; commentText: string }>,
  conversationMessages: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
  insertedComment: null as null | Record<string, unknown>,
}

function rowsForTable(name: string): unknown[] {
  if (name === 'story_comments') return dbState.bankedComments
  if (name === 'plan_conversations') return dbState.conversationMessages
  return dbState.annotationRows
}

vi.mock('@bedtime/core/db/client', () => {
  const select = vi.fn((_cols: unknown) => ({
    from: vi.fn((tbl: unknown) => ({
      where: vi.fn(() => {
        const rows = rowsForTable(tableName(tbl))
        return {
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(rows)),
            then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
              Promise.resolve(rows).then(resolve, reject),
          })),
          then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
            Promise.resolve(rows).then(resolve, reject),
        }
      }),
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
    dbState.bankedComments = []
    dbState.conversationMessages = []
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

  it('folds unapplied chat comments into the feedback sent to the plotter/writer', async () => {
    dbState.bankedComments = [
      { id: 11, commentText: 'пусть дракон будет добрее' },
      { id: 12, commentText: 'меньше диалогов' },
    ]

    const result = await gatherRedoFeedback({ storyId: 7, context: 'text' })

    expect(result.userFeedback).toContain('пусть дракон будет добрее')
    expect(result.userFeedback).toContain('меньше диалогов')
    expect(result.bankedCommentIds).toEqual([11, 12])
  })

  it('produces no banked-comment ids when there are no unapplied chat comments', async () => {
    const result = await gatherRedoFeedback({ storyId: 7, context: 'text' })

    expect(result.bankedCommentIds).toEqual([])
  })

  it('includes the plan conversation transcript so the plotter/writer sees what was discussed in chat', async () => {
    dbState.conversationMessages = [
      { role: 'user', content: 'пусть дракон будет добрее' },
      { role: 'assistant', content: 'хорошо, смягчу характер дракона' },
    ]

    const result = await gatherRedoFeedback({ storyId: 7, context: 'plan' })

    expect(result.userFeedback).toContain('Недавнее обсуждение в чате')
    expect(result.userFeedback).toContain('пусть дракон будет добрее')
    expect(result.userFeedback).toContain('хорошо, смягчу характер дракона')
  })
})
