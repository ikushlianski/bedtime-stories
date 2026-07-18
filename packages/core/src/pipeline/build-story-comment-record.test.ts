import { describe, it, expect } from 'vitest'
import { buildStoryCommentRecord } from './build-story-comment-record'

describe('buildStoryCommentRecord', () => {
  it('carries storyId, commentText, and selectedText through unchanged', () => {
    const record = buildStoryCommentRecord({
      storyId: 42,
      groupId: null,
      commentText: 'Саше очень понравилось',
      selectedText: null,
    })

    expect(record.storyId).toBe(42)
    expect(record.commentText).toBe('Саше очень понравилось')
    expect(record.selectedText).toBeNull()
  })

  it('sets universeId from groupId when the story belongs to a universe', () => {
    const record = buildStoryCommentRecord({
      storyId: 42,
      groupId: 7,
      commentText: 'здорово',
      selectedText: 'дракон зарычал',
    })

    expect(record.universeId).toBe(7)
    expect(record.selectedText).toBe('дракон зарычал')
  })

  it('sets universeId to null when the story has no group', () => {
    const record = buildStoryCommentRecord({
      storyId: 1,
      groupId: null,
      commentText: 'заметка',
      selectedText: null,
    })

    expect(record.universeId).toBeNull()
  })

  it('defaults source to chat when not specified', () => {
    const record = buildStoryCommentRecord({
      storyId: 1,
      groupId: null,
      commentText: 'заметка',
      selectedText: null,
    })

    expect(record.source).toBe('chat')
  })

  it('tags a revision reason distinctly from a regular chat comment', () => {
    const record = buildStoryCommentRecord({
      storyId: 1,
      groupId: null,
      commentText: 'сделай текст короче',
      selectedText: null,
      source: 'revision_reason',
    })

    expect(record.source).toBe('revision_reason')
  })
})
