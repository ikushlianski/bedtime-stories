import { describe, it, expect } from 'vitest'
import {
  annotationTypeLabel,
  sortAnnotationsByPosition,
  appendAnnotation,
  countByType,
  totalReactions,
} from './story-reader-annotations'
import type { Annotation } from '../lib/api'

function mkAnnotation(partial: Partial<Annotation> & Pick<Annotation, 'id' | 'type' | 'positionStart'>): Annotation {
  return {
    id: partial.id,
    storyId: partial.storyId ?? 1,
    type: partial.type,
    selectedText: partial.selectedText ?? 'some text',
    noteText: partial.noteText ?? null,
    positionStart: partial.positionStart,
    positionEnd: partial.positionEnd ?? (partial.positionStart ?? 0) + 10,
    createdAt: partial.createdAt ?? '2026-04-15T20:00:00Z',
  }
}

describe('annotationTypeLabel', () => {
  it('returns a human label for sasha_reaction', () => {
    expect(annotationTypeLabel('sasha_reaction')).toBe('Реакция Саши')
  })

  it('returns a human label for my_note', () => {
    expect(annotationTypeLabel('my_note')).toBe('Моя заметка')
  })

  it('returns a human label for sasha_laughed', () => {
    expect(annotationTypeLabel('sasha_laughed')).toBe('Саша смеялся')
  })

  it('returns a human label for sasha_loved', () => {
    expect(annotationTypeLabel('sasha_loved')).toBe('Саше понравилось')
  })

  it('returns a human label for sasha_disliked', () => {
    expect(annotationTypeLabel('sasha_disliked')).toBe('Слабое место')
  })
})

describe('sortAnnotationsByPosition', () => {
  it('orders annotations by position so the list follows the story flow', () => {
    const unsorted = [
      mkAnnotation({ id: 3, type: 'my_note', positionStart: 300 }),
      mkAnnotation({ id: 1, type: 'sasha_reaction', positionStart: 100 }),
      mkAnnotation({ id: 2, type: 'my_note', positionStart: 200 }),
    ]

    expect(sortAnnotationsByPosition(unsorted).map((a) => a.id)).toEqual([1, 2, 3])
  })

  it('breaks ties by id so ordering is deterministic', () => {
    const tied = [
      mkAnnotation({ id: 7, type: 'my_note', positionStart: 100 }),
      mkAnnotation({ id: 4, type: 'sasha_reaction', positionStart: 100 }),
    ]

    expect(sortAnnotationsByPosition(tied).map((a) => a.id)).toEqual([4, 7])
  })

  it('sends annotations with null positionStart to the end instead of crashing', () => {
    const mixed = [
      mkAnnotation({ id: 1, type: 'my_note', positionStart: null }),
      mkAnnotation({ id: 2, type: 'sasha_reaction', positionStart: 50 }),
    ]

    expect(sortAnnotationsByPosition(mixed).map((a) => a.id)).toEqual([2, 1])
  })

  it('does not mutate the input array', () => {
    const input = [
      mkAnnotation({ id: 2, type: 'my_note', positionStart: 200 }),
      mkAnnotation({ id: 1, type: 'sasha_reaction', positionStart: 100 }),
    ]

    sortAnnotationsByPosition(input)

    expect(input.map((a) => a.id)).toEqual([2, 1])
  })
})

describe('appendAnnotation', () => {
  it('adds a new annotation and keeps the list sorted', () => {
    const existing = [mkAnnotation({ id: 1, type: 'my_note', positionStart: 100 })]
    const fresh = mkAnnotation({ id: 2, type: 'sasha_reaction', positionStart: 50 })

    expect(appendAnnotation(existing, fresh).map((a) => a.id)).toEqual([2, 1])
  })

  it('is idempotent when the annotation already exists (same id)', () => {
    const existing = [mkAnnotation({ id: 1, type: 'my_note', positionStart: 100 })]
    const duplicate = mkAnnotation({ id: 1, type: 'sasha_reaction', positionStart: 999 })

    expect(appendAnnotation(existing, duplicate)).toBe(existing)
  })
})

describe('countByType', () => {
  it('counts annotations per type for the reader header chip', () => {
    const list = [
      mkAnnotation({ id: 1, type: 'sasha_reaction', positionStart: 0 }),
      mkAnnotation({ id: 2, type: 'sasha_laughed', positionStart: 10 }),
      mkAnnotation({ id: 3, type: 'my_note', positionStart: 20 }),
      mkAnnotation({ id: 4, type: 'sasha_loved', positionStart: 30 }),
      mkAnnotation({ id: 5, type: 'sasha_disliked', positionStart: 40 }),
    ]

    expect(countByType(list)).toEqual({
      sasha_reaction: 1,
      sasha_laughed: 1,
      sasha_loved: 1,
      sasha_disliked: 1,
      my_note: 1,
    })
  })

  it('returns zeros for every reaction type on an empty list', () => {
    expect(countByType([])).toEqual({
      sasha_reaction: 0,
      sasha_laughed: 0,
      sasha_loved: 0,
      sasha_disliked: 0,
      my_note: 0,
    })
  })
})

describe('totalReactions', () => {
  it('sums all reaction types but ignores my_note', () => {
    const counts = {
      sasha_reaction: 1,
      sasha_laughed: 2,
      sasha_loved: 3,
      sasha_disliked: 4,
      my_note: 99,
    }

    expect(totalReactions(counts)).toBe(10)
  })

  it('returns zero when there are no reactions', () => {
    const counts = {
      sasha_reaction: 0,
      sasha_laughed: 0,
      sasha_loved: 0,
      sasha_disliked: 0,
      my_note: 5,
    }

    expect(totalReactions(counts)).toBe(0)
  })
})
