import { describe, it, expect } from 'vitest'
import {
  EMPTY_STATE,
  addIdea,
  updateIdeaText,
  setIdeaStatus,
  removeIdea,
  openIdeas,
  serialize,
  deserialize,
} from './ideas-store'

const idea1 = {
  id: 'id-1',
  text: 'A hedgehog scared of loud noises',
  createdAt: '2026-04-15T18:00:00Z',
}

const idea2 = {
  id: 'id-2',
  text: 'A fox who lost his favourite stone',
  createdAt: '2026-04-15T18:05:00Z',
}

describe('addIdea', () => {
  it('prepends new ideas so the latest thought is on top', () => {
    const state = addIdea(addIdea(EMPTY_STATE, idea1), idea2)

    expect(state.items.map((i) => i.id)).toEqual(['id-2', 'id-1'])
  })

  it('trims whitespace-only input and drops blank ideas', () => {
    const state = addIdea(EMPTY_STATE, { ...idea1, text: '   ' })

    expect(state.items).toEqual([])
  })

  it('marks newly added ideas as open by default', () => {
    const state = addIdea(EMPTY_STATE, idea1)

    expect(state.items[0]?.status).toBe('open')
  })
})

describe('updateIdeaText', () => {
  it('replaces the text of the matching idea', () => {
    const state = addIdea(EMPTY_STATE, idea1)
    const updated = updateIdeaText(state, 'id-1', 'A hedgehog who is curious about thunder')

    expect(updated.items[0]?.text).toBe('A hedgehog who is curious about thunder')
  })

  it('ignores updates with empty text to avoid clobbering the idea', () => {
    const state = addIdea(EMPTY_STATE, idea1)
    const updated = updateIdeaText(state, 'id-1', '   ')

    expect(updated).toBe(state)
  })

  it('is a no-op when the id does not exist', () => {
    const state = addIdea(EMPTY_STATE, idea1)
    const updated = updateIdeaText(state, 'missing', 'anything')

    expect(updated.items[0]?.text).toBe(idea1.text)
  })
})

describe('setIdeaStatus and openIdeas', () => {
  it('transitions an idea to promoted without deleting it', () => {
    const state = addIdea(EMPTY_STATE, idea1)
    const promoted = setIdeaStatus(state, 'id-1', 'promoted')

    expect(promoted.items).toHaveLength(1)
    expect(promoted.items[0]?.status).toBe('promoted')
  })

  it('openIdeas returns only ideas still in the open bucket', () => {
    let state = addIdea(addIdea(EMPTY_STATE, idea1), idea2)
    state = setIdeaStatus(state, 'id-1', 'promoted')

    expect(openIdeas(state).map((i) => i.id)).toEqual(['id-2'])
  })
})

describe('removeIdea', () => {
  it('deletes the matching idea by id', () => {
    let state = addIdea(addIdea(EMPTY_STATE, idea1), idea2)
    state = removeIdea(state, 'id-1')

    expect(state.items.map((i) => i.id)).toEqual(['id-2'])
  })
})

describe('serialize / deserialize', () => {
  it('round-trips a non-empty state', () => {
    const state = addIdea(addIdea(EMPTY_STATE, idea1), idea2)
    const restored = deserialize(serialize(state))

    expect(restored).toEqual(state)
  })

  it('returns EMPTY_STATE for null or empty raw input', () => {
    expect(deserialize(null)).toEqual(EMPTY_STATE)
    expect(deserialize('')).toEqual(EMPTY_STATE)
  })

  it('returns EMPTY_STATE for malformed JSON instead of throwing', () => {
    expect(deserialize('not-json')).toEqual(EMPTY_STATE)
  })

  it('silently drops entries that do not match the Idea shape', () => {
    const bad = JSON.stringify({ items: [{ id: 'x' }, { id: 'y', text: 't', createdAt: 'c', status: 'open' }] })
    const restored = deserialize(bad)

    expect(restored.items).toHaveLength(1)
    expect(restored.items[0]?.id).toBe('y')
  })

  it('returns EMPTY_STATE when items is not an array', () => {
    expect(deserialize('{"items": "nope"}')).toEqual(EMPTY_STATE)
  })
})
