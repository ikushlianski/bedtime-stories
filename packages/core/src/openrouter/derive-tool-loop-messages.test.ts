import { describe, expect, it } from 'vitest'
import { clampToolIterations, deriveToolLoopMessages, MAX_TOOL_ITERATIONS } from './derive-tool-loop-messages'
import type { ChatMessage } from './openrouter.client'

describe('clampToolIterations', () => {
  it('returns MAX_TOOL_ITERATIONS when no override is requested', () => {
    expect(clampToolIterations(undefined)).toBe(MAX_TOOL_ITERATIONS)
  })

  it('never returns a value above MAX_TOOL_ITERATIONS regardless of a large requested value', () => {
    expect(clampToolIterations(500)).toBe(MAX_TOOL_ITERATIONS)
    expect(clampToolIterations(Number.MAX_SAFE_INTEGER)).toBe(MAX_TOOL_ITERATIONS)
  })

  it('clamps a zero or negative requested value up to at least 1', () => {
    expect(clampToolIterations(0)).toBe(1)
    expect(clampToolIterations(-10)).toBe(1)
  })

  it('preserves an in-range requested value', () => {
    expect(clampToolIterations(2)).toBe(2)
  })

  it('floors a fractional requested value', () => {
    expect(clampToolIterations(2.9)).toBe(2)
  })
})

describe('deriveToolLoopMessages', () => {
  const baseMessages: ChatMessage[] = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hi' },
  ]

  const assistantMessage: ChatMessage = {
    role: 'assistant',
    content: null,
    tool_calls: [
      { id: 'call_1', function: { name: 'search_past_stories', arguments: '{"query":"a"}' } },
      { id: 'call_2', function: { name: 'search_past_stories', arguments: '{"query":"b"}' } },
    ],
  }

  it('appends exactly one role: tool message per tool result', () => {
    const next = deriveToolLoopMessages(baseMessages, assistantMessage, [
      { tool_call_id: 'call_1', result: 'result one' },
      { tool_call_id: 'call_2', result: 'result two' },
    ])

    const toolMessages = next.filter((m) => m.role === 'tool')

    expect(toolMessages).toHaveLength(2)
  })

  it('tags each tool message with its own tool_call_id', () => {
    const next = deriveToolLoopMessages(baseMessages, assistantMessage, [
      { tool_call_id: 'call_1', result: 'result one' },
      { tool_call_id: 'call_2', result: 'result two' },
    ])

    const toolMessages = next.filter((m): m is ChatMessage & { role: 'tool' } => m.role === 'tool')

    expect(toolMessages[0]?.tool_call_id).toBe('call_1')
    expect(toolMessages[0]?.content).toBe('result one')
    expect(toolMessages[1]?.tool_call_id).toBe('call_2')
    expect(toolMessages[1]?.content).toBe('result two')
  })

  it('preserves the original messages and appends the assistant tool-call message before the tool results', () => {
    const next = deriveToolLoopMessages(baseMessages, assistantMessage, [
      { tool_call_id: 'call_1', result: 'result one' },
    ])

    expect(next[0]).toEqual(baseMessages[0])
    expect(next[1]).toEqual(baseMessages[1])
    expect(next[2]).toEqual(assistantMessage)
    expect(next[3]).toMatchObject({ role: 'tool', tool_call_id: 'call_1' })
  })

  it('does not mutate the input messages array', () => {
    const original = [...baseMessages]

    deriveToolLoopMessages(baseMessages, assistantMessage, [{ tool_call_id: 'call_1', result: 'x' }])

    expect(baseMessages).toEqual(original)
  })
})
