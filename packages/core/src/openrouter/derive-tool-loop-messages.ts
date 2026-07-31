import type { ChatMessage } from './openrouter.client.js'

export const MAX_TOOL_ITERATIONS = 3
export const MAX_TOOL_CALLS_PER_ITERATION = 3

export function clampToolIterations(requested?: number): number {
  if (requested === undefined) {
    return MAX_TOOL_ITERATIONS
  }

  return Math.max(1, Math.min(MAX_TOOL_ITERATIONS, Math.floor(requested)))
}

export interface ToolCallResult {
  tool_call_id: string
  result: string
}

export function deriveToolLoopMessages(
  messages: ChatMessage[],
  assistantMessage: ChatMessage,
  results: ToolCallResult[],
): ChatMessage[] {
  const toolMessages: ChatMessage[] = results.map((r) => ({
    role: 'tool',
    content: r.result,
    tool_call_id: r.tool_call_id,
  }))

  return [...messages, assistantMessage, ...toolMessages]
}
