const BASE_URL = 'https://openrouter.ai/api/v1'
const REQUEST_TIMEOUT_MS = 180_000

function withTimeout(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`OpenRouter request exceeded timeout of ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS)

  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

function toTimeoutError(err: unknown): unknown {
  if (err instanceof Error && err.name === 'AbortError') {
    return new Error(`OpenRouter request exceeded timeout of ${REQUEST_TIMEOUT_MS}ms`)
  }

  return err
}

export interface OpenRouterUsage {
  promptTokens: number
  completionTokens: number
  costUsd: number
}

export interface ChatRequest {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  stream?: boolean
  temperature?: number
  response_format?: unknown
}

export interface ChatNonStreamResult {
  text: string
  usage: OpenRouterUsage
}

export interface ChatStreamEvent {
  delta?: string
  usage?: OpenRouterUsage
}

export class OpenRouterHttpError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`OpenRouter HTTP ${status}: ${body.slice(0, 500)}`)
  }
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://bedtime.local',
    'X-Title': 'bedtime-agent',
  }
}

export class OpenRouterClient {
  constructor(private readonly apiKey: string) {}

  async listModels(): Promise<unknown> {
    const { signal, clear } = withTimeout()

    try {
      const res = await fetch(`${BASE_URL}/models`, {
        method: 'GET',
        headers: authHeaders(this.apiKey),
        signal,
      })

      if (!res.ok) {
        throw new OpenRouterHttpError(res.status, await res.text())
      }

      return await res.json()
    } catch (err) {
      throw toTimeoutError(err)
    } finally {
      clear()
    }
  }

  async chatNonStream(req: ChatRequest): Promise<ChatNonStreamResult> {
    const body = { ...req, stream: false }
    const { signal, clear } = withTimeout()

    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: authHeaders(this.apiKey),
        body: JSON.stringify(body),
        signal,
      })

      if (!res.ok) {
        throw new OpenRouterHttpError(res.status, await res.text())
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
      }

      const text = json.choices?.[0]?.message?.content ?? ''
      const usage: OpenRouterUsage = {
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
        costUsd: json.usage?.cost ?? 0,
      }

      return { text, usage }
    } catch (err) {
      throw toTimeoutError(err)
    } finally {
      clear()
    }
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatStreamEvent> {
    const body = { ...req, stream: true, usage: { include: true } }
    const { signal, clear } = withTimeout()

    let res: Response
    try {
      res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: authHeaders(this.apiKey),
        body: JSON.stringify(body),
        signal,
      })
    } catch (err) {
      clear()
      throw toTimeoutError(err)
    }

    if (!res.ok || res.body === null) {
      clear()
      throw new OpenRouterHttpError(res.status, res.body === null ? 'no body' : await res.text())
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    try {
      while (true) {
        let value: Uint8Array | undefined
        let done: boolean
        try {
          ;({ value, done } = await reader.read())
        } catch (err) {
          throw toTimeoutError(err)
        }
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let idx
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim()
          buffer = buffer.slice(idx + 1)

          if (line === '' || line.startsWith(':')) continue
          if (!line.startsWith('data:')) continue

          const data = line.slice(5).trim()
          if (data === '[DONE]') return

          let parsed: {
            choices?: Array<{ delta?: { content?: string } }>
            usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
          }

          try {
            parsed = JSON.parse(data)
          } catch {
            continue
          }

          const delta = parsed.choices?.[0]?.delta?.content
          if (delta !== undefined && delta !== '') yield { delta }

          if (parsed.usage !== undefined) {
            yield {
              usage: {
                promptTokens: parsed.usage.prompt_tokens ?? 0,
                completionTokens: parsed.usage.completion_tokens ?? 0,
                costUsd: parsed.usage.cost ?? 0,
              },
            }
          }
        }
      }
    } finally {
      clear()
    }
  }
}
