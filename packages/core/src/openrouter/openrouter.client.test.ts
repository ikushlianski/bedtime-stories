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

describe('OpenRouterClient.generateImage', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('sends each reference URL as an image_url object, per OpenRouter\'s documented shape', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [{ b64_json: 'abc', media_type: 'image/png' }], usage: {} }),
      } as Response),
    )
    global.fetch = fetchMock as unknown as typeof fetch

    const client = new OpenRouterClient('test-key')

    await client.generateImage({
      model: 'google/gemini-2.5-flash-image',
      prompt: 'a friendly character portrait',
      inputReferences: ['https://example.com/ref-1.png', 'https://example.com/ref-2.png'],
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)

    expect(body.input_references).toEqual([
      { type: 'image_url', image_url: { url: 'https://example.com/ref-1.png' } },
      { type: 'image_url', image_url: { url: 'https://example.com/ref-2.png' } },
    ])
  })

  it('omits input_references entirely when no references are given', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [{ b64_json: 'abc', media_type: 'image/png' }], usage: {} }),
      } as Response),
    )
    global.fetch = fetchMock as unknown as typeof fetch

    const client = new OpenRouterClient('test-key')

    await client.generateImage({ model: 'google/gemini-2.5-flash-image', prompt: 'a friendly character portrait' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)

    expect(body.input_references).toBeUndefined()
  })
})
