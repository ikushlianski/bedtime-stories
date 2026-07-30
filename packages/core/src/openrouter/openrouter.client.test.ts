import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenRouterClient } from './openrouter.client'

describe('OpenRouterClient request timeout', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    global.fetch = originalFetch
  })

  it('rejects chatNonStream with a timeout error when the provider never responds', async () => {
    global.fetch = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('This operation was aborted', 'AbortError'))
        })
      })
    }) as unknown as typeof fetch

    const client = new OpenRouterClient('test-key')

    const call = client.chatNonStream({ model: 'test-model', messages: [] })
    const assertion = expect(call).rejects.toThrow(/timeout/i)

    await vi.advanceTimersByTimeAsync(180_000)
    await assertion
  })

  it('rejects listModels with a timeout error when the provider never responds', async () => {
    global.fetch = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('This operation was aborted', 'AbortError'))
        })
      })
    }) as unknown as typeof fetch

    const client = new OpenRouterClient('test-key')

    const call = client.listModels()
    const assertion = expect(call).rejects.toThrow(/timeout/i)

    await vi.advanceTimersByTimeAsync(180_000)
    await assertion
  })

  it('does not time out a call that resolves well within the limit', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: 'hi' } }], usage: {} }),
      } as Response),
    ) as unknown as typeof fetch

    const client = new OpenRouterClient('test-key')

    await expect(client.chatNonStream({ model: 'test-model', messages: [] })).resolves.toEqual({
      text: 'hi',
      usage: { promptTokens: 0, completionTokens: 0, costUsd: 0 },
    })
  })
})
