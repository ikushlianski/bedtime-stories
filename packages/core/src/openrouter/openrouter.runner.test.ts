import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

vi.mock('../db/client.js', () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ supportsJsonSchema: true }]),
          })),
        })),
      })),
    },
  }
})

vi.mock('../env.js', () => ({ env: { OPENROUTER_API_KEY: 'test-key' } }))

vi.mock('node:fs/promises', () => ({ readFile: vi.fn(async () => '---\nname: x\n---\nSKILL BODY') }))
vi.mock('node:fs', async (orig) => {
  const real = (await orig()) as Record<string, unknown>
  return { ...real, existsSync: () => true }
})

import { OpenRouterRunner, AiValidationError } from './openrouter.runner'
import type { OpenRouterClient, ChatStreamEvent, ChatNonStreamResult } from './openrouter.client'
import { OpenRouterHttpError } from './openrouter.client'
import type { CostRecorder } from '../cost/cost-recorder'

function makeRecorder(): CostRecorder & { calls: unknown[] } {
  const calls: unknown[] = []
  return {
    calls,
    async record(input) {
      calls.push(input)
    },
  }
}

async function* streamFrom(events: ChatStreamEvent[]): AsyncIterable<ChatStreamEvent> {
  for (const e of events) yield e
}

describe('OpenRouterRunner.runText', () => {
  beforeEach(() => vi.clearAllMocks())

  it('streams text and records a successful model_calls row', async () => {
    const recorder = makeRecorder()
    const client = {
      chatStream: vi.fn(() =>
        streamFrom([
          { delta: 'Hello ' },
          { delta: 'world' },
          { usage: { promptTokens: 10, completionTokens: 2, costUsd: 0.0001 } },
        ]),
      ),
      chatNonStream: vi.fn(),
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)

    const result = await runner.runText({
      model: 'm/preferred',
      prompt: 'hi',
      label: 'plotter:v1',
      storyId: 7,
    })

    expect(result).toBe('Hello world')
    expect(recorder.calls).toHaveLength(1)
    expect(recorder.calls[0]).toMatchObject({
      storyId: 7,
      stage: 'plotter',
      modelId: 'm/preferred',
      attempt: 1,
      fallbackUsed: false,
      tokensIn: 10,
      tokensOut: 2,
      success: true,
    })
  })

  it('falls back to the configured fallback model when preferred returns 429', async () => {
    const recorder = makeRecorder()
    let call = 0
    const client = {
      chatStream: vi.fn(() => {
        call++

        if (call === 1) {
          return (async function* () {
            throw new OpenRouterHttpError(429, 'rate limited')
            yield { delta: '' } as ChatStreamEvent
          })()
        }

        return streamFrom([{ delta: 'fallback ok' }, { usage: { promptTokens: 5, completionTokens: 2, costUsd: 0.00005 } }])
      }),
      chatNonStream: vi.fn(),
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)

    const result = await runner.runText({
      model: 'm/preferred',
      prompt: 'hi',
      fallback: 'm/fallback',
      stage: 'writer',
    })

    expect(result).toBe('fallback ok')
    expect(recorder.calls).toHaveLength(2)
    expect(recorder.calls[0]).toMatchObject({ modelId: 'm/preferred', success: false, fallbackUsed: false })
    expect(recorder.calls[1]).toMatchObject({ modelId: 'm/fallback', success: true, fallbackUsed: true })
  })
})

describe('OpenRouterRunner.runText with tools', () => {
  beforeEach(() => vi.clearAllMocks())

  const tool = {
    name: 'search_past_stories',
    description: 'search',
    parameters: { type: 'object' as const, properties: { query: { type: 'string' } }, required: ['query'] },
  }

  it('executes a requested tool call, feeds the result back, and returns the final text once the model stops calling tools', async () => {
    const recorder = makeRecorder()
    const chatNonStream = vi
      .fn()
      .mockResolvedValueOnce({
        text: '',
        usage: { promptTokens: 10, completionTokens: 5, costUsd: 0.001 },
        toolCalls: [{ id: 'call_1', function: { name: 'search_past_stories', arguments: '{"query":"a"}' } }],
      })
      .mockResolvedValueOnce({
        text: 'final outline text',
        usage: { promptTokens: 20, completionTokens: 8, costUsd: 0.002 },
      })

    const client = {
      chatStream: vi.fn(),
      chatNonStream,
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)
    const executeTool = vi.fn(async () => 'tool result text')

    const result = await runner.runText({
      model: 'm/plotter',
      prompt: 'plan a story',
      tools: [tool],
      executeTool,
      storyId: 1,
    })

    expect(result).toBe('final outline text')
    expect(executeTool).toHaveBeenCalledWith('search_past_stories', '{"query":"a"}')
    expect(recorder.calls).toHaveLength(2)
    expect(recorder.calls[0]).toMatchObject({ attempt: 1, success: true, tokensIn: 10 })
    expect(recorder.calls[1]).toMatchObject({ attempt: 2, success: true, tokensIn: 20 })

    const secondCallMessages = chatNonStream.mock.calls[1]?.[0]?.messages as Array<{ role: string }>
    expect(secondCallMessages.some((m) => m.role === 'tool')).toBe(true)
  })

  it('completes normally when the model never calls the tool', async () => {
    const recorder = makeRecorder()
    const chatNonStream = vi.fn().mockResolvedValueOnce({
      text: 'outline without any callback',
      usage: { promptTokens: 10, completionTokens: 5, costUsd: 0.001 },
    })

    const client = {
      chatStream: vi.fn(),
      chatNonStream,
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)
    const executeTool = vi.fn()

    const result = await runner.runText({
      model: 'm/plotter',
      prompt: 'plan a story',
      tools: [tool],
      executeTool,
    })

    expect(result).toBe('outline without any callback')
    expect(executeTool).not.toHaveBeenCalled()
    expect(recorder.calls).toHaveLength(1)
  })

  it('stops after MAX_TOOL_ITERATIONS even when the model keeps requesting the tool every turn, recording every iteration', async () => {
    const recorder = makeRecorder()
    const chatNonStream = vi.fn().mockResolvedValue({
      text: 'still thinking',
      usage: { promptTokens: 5, completionTokens: 2, costUsd: 0.0001 },
      toolCalls: [{ id: 'call_x', function: { name: 'search_past_stories', arguments: '{"query":"x"}' } }],
    })

    const client = {
      chatStream: vi.fn(),
      chatNonStream,
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)
    const executeTool = vi.fn(async () => 'result')

    const result = await runner.runText({
      model: 'm/plotter',
      prompt: 'plan a story',
      tools: [tool],
      executeTool,
    })

    expect(result).toBe('still thinking')
    expect(chatNonStream).toHaveBeenCalledTimes(3)
    expect(recorder.calls).toHaveLength(3)
  })

  it('executes at most MAX_TOOL_CALLS_PER_ITERATION tool calls when a single response requests more', async () => {
    const recorder = makeRecorder()
    const manyCalls = Array.from({ length: 6 }, (_, i) => ({
      id: `call_${i}`,
      function: { name: 'search_past_stories', arguments: '{"query":"x"}' },
    }))

    const chatNonStream = vi
      .fn()
      .mockResolvedValueOnce({
        text: '',
        usage: { promptTokens: 5, completionTokens: 2, costUsd: 0.0001 },
        toolCalls: manyCalls,
      })
      .mockResolvedValueOnce({
        text: 'done',
        usage: { promptTokens: 5, completionTokens: 2, costUsd: 0.0001 },
      })

    const client = {
      chatStream: vi.fn(),
      chatNonStream,
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)
    const executeTool = vi.fn(async () => 'result')

    await runner.runText({
      model: 'm/plotter',
      prompt: 'plan a story',
      tools: [tool],
      executeTool,
    })

    expect(executeTool).toHaveBeenCalledTimes(3)
  })

  it('falls back to the configured fallback model when the primary model times out mid tool-loop', async () => {
    const recorder = makeRecorder()
    let call = 0
    const chatNonStream = vi.fn(async (req: { model: string }) => {
      call++

      if (call === 1) {
        throw new Error('OpenRouter request exceeded timeout of 180000ms')
      }

      expect(req.model).toBe('m/fallback')

      return {
        text: 'final outline from fallback',
        usage: { promptTokens: 12, completionTokens: 6, costUsd: 0.0004 },
      }
    })

    const client = {
      chatStream: vi.fn(),
      chatNonStream,
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)
    const executeTool = vi.fn()

    const result = await runner.runText({
      model: 'm/plotter',
      fallback: 'm/fallback',
      prompt: 'plan a story',
      tools: [tool],
      executeTool,
    })

    expect(result).toBe('final outline from fallback')
    expect(chatNonStream).toHaveBeenCalledTimes(2)
    expect(chatNonStream.mock.calls[0]?.[0]).toMatchObject({ model: 'm/plotter' })
    expect(chatNonStream.mock.calls[1]?.[0]).toMatchObject({ model: 'm/fallback' })
    expect(recorder.calls[0]).toMatchObject({ modelId: 'm/plotter', success: false, fallbackUsed: false })
    expect(recorder.calls[1]).toMatchObject({ modelId: 'm/fallback', success: true, fallbackUsed: true })
  })

  it('rethrows without retrying when there is no fallback configured for the tool-loop path', async () => {
    const recorder = makeRecorder()
    const chatNonStream = vi.fn(async () => {
      throw new Error('OpenRouter request exceeded timeout of 180000ms')
    })

    const client = {
      chatStream: vi.fn(),
      chatNonStream,
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)
    const executeTool = vi.fn()

    await expect(
      runner.runText({
        model: 'm/plotter',
        prompt: 'plan a story',
        tools: [tool],
        executeTool,
      }),
    ).rejects.toThrow('exceeded timeout')

    expect(chatNonStream).toHaveBeenCalledTimes(1)
  })

  it('feeds a structured error back to the model instead of throwing when executeTool rejects', async () => {
    const recorder = makeRecorder()
    const chatNonStream = vi
      .fn()
      .mockResolvedValueOnce({
        text: '',
        usage: { promptTokens: 5, completionTokens: 2, costUsd: 0.0001 },
        toolCalls: [{ id: 'call_1', function: { name: 'search_past_stories', arguments: '{"query":"x"}' } }],
      })
      .mockResolvedValueOnce({
        text: 'proceeded without the callback',
        usage: { promptTokens: 5, completionTokens: 2, costUsd: 0.0001 },
      })

    const client = {
      chatStream: vi.fn(),
      chatNonStream,
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)
    const executeTool = vi.fn(async () => {
      throw new Error('retrieval failed')
    })

    const result = await runner.runText({
      model: 'm/plotter',
      prompt: 'plan a story',
      tools: [tool],
      executeTool,
    })

    expect(result).toBe('proceeded without the callback')

    const secondCallMessages = chatNonStream.mock.calls[1]?.[0]?.messages as Array<{ role: string; content?: string }>
    const toolMessage = secondCallMessages.find((m) => m.role === 'tool')
    expect(toolMessage?.content).toContain('tool_execution_failed')
  })
})

describe('OpenRouterRunner.runStructured', () => {
  beforeEach(() => vi.clearAllMocks())

  const schema = z.object({ verdict: z.string() })

  it('parses native structured output successfully', async () => {
    const recorder = makeRecorder()
    const result: ChatNonStreamResult = {
      text: '{"verdict":"good"}',
      usage: { promptTokens: 5, completionTokens: 3, costUsd: 0.0001 },
    }
    const client = {
      chatStream: vi.fn(),
      chatNonStream: vi.fn(async () => result),
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)

    const r = await runner.runStructured({
      skill: 'plot-critic',
      model: 'm/native',
      prompt: 'critique this',
      outputSchema: schema,
      cwd: process.cwd(),
    })

    expect(r).toEqual({ verdict: 'good' })
    expect(recorder.calls[0]).toMatchObject({ modelId: 'm/native', success: true, stage: 'plot-critic' })
  })

  it('uses prompt-coaxed JSON path for non-json_schema model and succeeds', async () => {
    const { db } = (await import('../db/client.js')) as unknown as {
      db: { select: ReturnType<typeof vi.fn> }
    }
    db.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [{ supportsJsonSchema: false }],
        }),
      }),
    })

    const recorder = makeRecorder()
    const client = {
      chatStream: vi.fn(),
      chatNonStream: vi.fn(async () => ({
        text: '```json\n{"verdict":"ok"}\n```',
        usage: { promptTokens: 5, completionTokens: 3, costUsd: 0.0001 },
      })),
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)

    const r = await runner.runStructured({
      skill: 'plot-critic',
      model: 'm/no-json-schema',
      prompt: 'critique',
      outputSchema: schema,
      cwd: process.cwd(),
    })

    expect(r).toEqual({ verdict: 'ok' })
    const sent = (client.chatNonStream as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { response_format?: unknown; messages: Array<{ role: string; content: string }> }
    expect(sent.response_format).toBeUndefined()
    expect(sent.messages[0]?.content).toContain('JSON value')
  })

  it('throws AiValidationError after 3 invalid responses', async () => {
    const recorder = makeRecorder()
    const client = {
      chatStream: vi.fn(),
      chatNonStream: vi.fn(async () => ({
        text: 'not json at all',
        usage: { promptTokens: 1, completionTokens: 1, costUsd: 0 },
      })),
      listModels: vi.fn(),
    } as unknown as OpenRouterClient

    const runner = new OpenRouterRunner(client, recorder)

    await expect(
      runner.runStructured({
        skill: 'plot-critic',
        model: 'm/native',
        prompt: 'critique',
        outputSchema: schema,
        cwd: process.cwd(),
      }),
    ).rejects.toBeInstanceOf(AiValidationError)

    expect(client.chatNonStream).toHaveBeenCalledTimes(3)
  })
})
