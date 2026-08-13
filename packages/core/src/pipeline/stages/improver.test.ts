import { describe, it, expect, vi } from 'vitest'
import type { Feedback } from '../../db/types'

let mockRows: Feedback[] = []

vi.mock('../../db/client', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async (n: number) => mockRows.slice(0, n)),
          })),
        })),
      })),
    })),
  },
}))

const {
  formatStructuredFeedback,
  formatHistoricalFeedbackLines,
  buildPass2Prompt,
  fetchAgentRunFeedbacks,
  PASS_1_PROMPT_PREFIX,
  PASS_2_PROMPT_PREFIX,
} = await import('./improver')

function makeFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    id: 1,
    storyId: 1,
    rating: 4,
    comment: 'Loved it',
    feedbackType: 'agent_run',
    createdAt: new Date('2026-01-01'),
    structuredFeedback: null,
    ...overrides,
  }
}

describe('formatStructuredFeedback', () => {
  it('returns an empty string for null input', () => {
    expect(formatStructuredFeedback(null)).toBe('')
  })

  it('returns an empty string for undefined input', () => {
    expect(formatStructuredFeedback(undefined)).toBe('')
  })

  it('returns an empty string when every field is null', () => {
    expect(
      formatStructuredFeedback({
        enjoyed: null,
        was_funny: null,
        was_scary: null,
        too_long: null,
        favorite_moment: null,
        favorite_character: null,
        understood_moral: null,
        want_again: null,
        notes: null,
      }),
    ).toBe('')
  })

  it('includes only the field that has a meaningful value', () => {
    expect(formatStructuredFeedback({ was_funny: true })).toBe(' [Funny: yes]')
  })

  it('formats enjoyed as a rating out of 5', () => {
    expect(formatStructuredFeedback({ enjoyed: 4 })).toBe(' [Enjoyed: 4/5]')
  })

  it('formats boolean fields as yes/no', () => {
    expect(
      formatStructuredFeedback({
        was_scary: false,
        too_long: true,
        understood_moral: true,
        want_again: false,
      }),
    ).toBe(' [Scary: no, Too long: yes, Understood moral: yes, Wants again: no]')
  })

  it('includes all nine fields in schema order when all are present', () => {
    expect(
      formatStructuredFeedback({
        enjoyed: 5,
        was_funny: true,
        was_scary: false,
        too_long: false,
        favorite_moment: 'the dragon roared',
        favorite_character: 'the dragon',
        understood_moral: true,
        want_again: true,
        notes: 'more dragons please',
      }),
    ).toBe(
      ' [Enjoyed: 5/5, Funny: yes, Scary: no, Too long: no, Favorite moment: the dragon roared, ' +
        'Favorite character: the dragon, Understood moral: yes, Wants again: yes, Notes: more dragons please]',
    )
  })

  it('omits free-text fields that are empty or whitespace-only', () => {
    expect(formatStructuredFeedback({ favorite_moment: '   ', notes: '' })).toBe('')
  })

  it('truncates a free-text field longer than 200 characters with an ellipsis suffix', () => {
    const longText = 'a'.repeat(250)

    const result = formatStructuredFeedback({ notes: longText })

    expect(result).toBe(` [Notes: ${'a'.repeat(200)}…]`)
  })

  it('does not truncate a free-text field at exactly 200 characters', () => {
    const exactText = 'b'.repeat(200)

    const result = formatStructuredFeedback({ favorite_character: exactText })

    expect(result).toBe(` [Favorite character: ${exactText}]`)
  })
})

describe('formatHistoricalFeedbackLines', () => {
  it('is byte-identical to the plain rating/comment line for a row with no structured feedback', () => {
    const feedbacks = [makeFeedback({ id: 1, rating: 3, comment: 'It was okay', structuredFeedback: null })]

    expect(formatHistoricalFeedbackLines(feedbacks)).toBe('1. Rating: 3 — It was okay')
  })

  it('appends the structured-feedback suffix for a row that has structured data', () => {
    const feedbacks = [
      makeFeedback({
        id: 1,
        rating: 2,
        comment: 'Bit long',
        structuredFeedback: {
          enjoyed: 3,
          was_funny: false,
          was_scary: false,
          too_long: true,
          favorite_moment: '',
          favorite_character: '',
          understood_moral: false,
          want_again: false,
          notes: '',
        },
      }),
    ]

    expect(formatHistoricalFeedbackLines(feedbacks)).toBe(
      '1. Rating: 2 — Bit long [Enjoyed: 3/5, Funny: no, Scary: no, Too long: yes, Understood moral: no, Wants again: no]',
    )
  })

  it('falls back to N/A and (no comment) placeholders like before', () => {
    const feedbacks = [makeFeedback({ id: 1, rating: null, comment: null, structuredFeedback: null })]

    expect(formatHistoricalFeedbackLines(feedbacks)).toBe('1. Rating: N/A — (no comment)')
  })
})

describe('buildPass2Prompt', () => {
  it('is byte-identical to today\'s output for a recent feedback row with structuredFeedback: null', () => {
    const feedbacks = [makeFeedback({ id: 7, rating: 5, comment: 'Great story', structuredFeedback: null })]

    const prompt = buildPass2Prompt('', feedbacks, [])

    expect(prompt).toContain('- id=7 rating=5: Great story\n')
    expect(prompt).not.toContain('- id=7 rating=5: Great story [')
  })

  it('includes the structured-feedback suffix in the recent-feedback section', () => {
    const feedbacks = [
      makeFeedback({
        id: 9,
        rating: 2,
        comment: 'Too scary',
        structuredFeedback: {
          enjoyed: 2,
          was_funny: false,
          was_scary: true,
          too_long: false,
          favorite_moment: '',
          favorite_character: '',
          understood_moral: false,
          want_again: false,
          notes: '',
        },
      }),
    ]

    const prompt = buildPass2Prompt('', feedbacks, [])

    expect(prompt).toContain('- id=9 rating=2: Too scary [Enjoyed: 2/5, Funny: no, Scary: yes, Too long: no, Understood moral: no, Wants again: no]')
  })

  it('includes the historical summary section when provided', () => {
    const prompt = buildPass2Prompt('Parents want shorter stories', [], [])

    expect(prompt).toContain('HISTORICAL PATTERNS (compressed from older feedbacks):\nParents want shorter stories')
  })
})

describe('fetchAgentRunFeedbacks', () => {
  it('caps the number of rows returned at 100 even when more rows exist', async () => {
    mockRows = Array.from({ length: 150 }, (_, i) =>
      makeFeedback({ id: i + 1, createdAt: new Date(2026, 0, 150 - i) }),
    )

    const result = await fetchAgentRunFeedbacks()

    expect(result).toHaveLength(100)
  })

  it('returns every row when fewer than the cap exist', async () => {
    mockRows = Array.from({ length: 3 }, (_, i) => makeFeedback({ id: i + 1 }))

    const result = await fetchAgentRunFeedbacks()

    expect(result).toHaveLength(3)
  })
})

describe('prompt instruction constants', () => {
  it('tells the model structured signals count as feedback patterns in Pass 1', () => {
    expect(PASS_1_PROMPT_PREFIX).toContain(
      'including both free-text comments and structured signals',
    )
    expect(PASS_1_PROMPT_PREFIX).toContain('Too long: yes')
  })

  it('tells the model a repeated structured field counts as a feedback signal in Pass 2', () => {
    expect(PASS_2_PROMPT_PREFIX).toContain('a structured field repeated across rows')
    expect(PASS_2_PROMPT_PREFIX).toContain('Too long: yes')
    expect(PASS_2_PROMPT_PREFIX).toContain('counts as a feedback signal on its own')
  })
})
