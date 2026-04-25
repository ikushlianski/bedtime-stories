import { describe, it, expect } from 'vitest'
import { deriveAwaitingFeedbackInbox, type AwaitingInboxStoryRow } from './derive-awaiting-feedback-inbox'

const at = (ms: number): Date => new Date(ms)

describe('deriveAwaitingFeedbackInbox', () => {
  it('returns empty for no input', () => {
    expect(deriveAwaitingFeedbackInbox([])).toEqual([])
  })

  it('only returns ready or read stories without feedback, ordered by ready_at desc', () => {
    const rows: AwaitingInboxStoryRow[] = [
      { storyId: 1, title: 'A', status: 'ready', readyAt: at(1000), hasFeedback: false },
      { storyId: 2, title: 'B', status: 'read', readyAt: at(3000), hasFeedback: false },
      { storyId: 3, title: 'C', status: 'read', readyAt: at(2000), hasFeedback: true },
      { storyId: 4, title: 'D', status: 'draft', readyAt: null, hasFeedback: false },
      { storyId: 5, title: 'E', status: 'archived', readyAt: at(4000), hasFeedback: false },
    ]

    const result = deriveAwaitingFeedbackInbox(rows)

    expect(result.map((r) => r.storyId)).toEqual([2, 1])
  })
})
