export const PLAN_CONVERSATION_HISTORY_LIMIT = 20

export interface ConversationMessageInput {
  role: 'user' | 'assistant'
  content: string
}

export function formatPlanConversationAsFeedback(messages: ConversationMessageInput[]): string {
  if (messages.length === 0) return ''

  const recent = messages.slice(-PLAN_CONVERSATION_HISTORY_LIMIT)

  const transcript = recent
    .map((m) => `${m.role === 'user' ? 'Родитель' : 'Ассистент'}: ${m.content}`)
    .join('\n\n')

  return `Недавнее обсуждение в чате (учти контекст и договорённости из разговора):\n${transcript}`
}
