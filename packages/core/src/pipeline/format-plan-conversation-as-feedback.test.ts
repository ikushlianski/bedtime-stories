import { describe, it, expect } from 'vitest'
import { formatPlanConversationAsFeedback, PLAN_CONVERSATION_HISTORY_LIMIT } from './format-plan-conversation-as-feedback'

describe('formatPlanConversationAsFeedback', () => {
  it('renders the conversation as a labeled parent/assistant transcript', () => {
    const result = formatPlanConversationAsFeedback([
      { role: 'user', content: 'пусть дракон будет добрее' },
      { role: 'assistant', content: 'хорошо, смягчу характер дракона' },
    ])

    expect(result).toBe(
      'Недавнее обсуждение в чате (учти контекст и договорённости из разговора):\n' +
        'Родитель: пусть дракон будет добрее\n\n' +
        'Ассистент: хорошо, смягчу характер дракона',
    )
  })

  it('keeps only the most recent messages when history exceeds the limit', () => {
    const messages = Array.from({ length: PLAN_CONVERSATION_HISTORY_LIMIT + 5 }, (_, i) => ({
      role: 'user' as const,
      content: `сообщение ${i}`,
    }))

    const result = formatPlanConversationAsFeedback(messages)

    expect(result).not.toContain('сообщение 0')
    expect(result).not.toContain('сообщение 4')
    expect(result).toContain(`сообщение ${PLAN_CONVERSATION_HISTORY_LIMIT + 4}`)
  })

  it('returns an empty string when there is no conversation', () => {
    expect(formatPlanConversationAsFeedback([])).toBe('')
  })
})
