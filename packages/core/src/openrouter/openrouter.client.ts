import { toToolWireFormat, type ToolCall, type ToolDefinition } from './tool-types.js'

const BASE_URL = 'https://openrouter.ai/api/v1'

export interface OpenRouterUsage {
  promptTokens: number
  completionTokens: number
  costUsd: number
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  stream?: boolean
  temperature?: number
  response_format?: unknown
  tools?: ToolDefinition[]
}

export interface ChatNonStreamResult {
  text: string
  usage: OpenRouterUsage
  toolCalls?: ToolCall[]
}

export interface EmbedResult {
  embeddings: number[][]
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
    const res = await fetch(`${BASE_URL}/models`, {
      method: 'GET',
      headers: authHeaders(this.apiKey),
    })

    if (!res.ok) {
      throw new OpenRouterHttpError(res.status, await res.text())
    }

    return res.json()
  }

  async chatNonStream(req: ChatRequest): Promise<ChatNonStreamResult> {
    const { tools, ...rest } = req
    const body = {
      ...rest,
      stream: false,
      ...(tools !== undefined && tools.length > 0 ? { tools: tools.map(toToolWireFormat) } : {}),
    }
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(this.apiKey),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new OpenRouterHttpError(res.status, await res.text())
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string; tool_calls?: ToolCall[] } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
    }

    const text = json.choices?.[0]?.message?.content ?? ''
    const toolCalls = json.choices?.[0]?.message?.tool_calls
    const usage: OpenRouterUsage = {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      costUsd: json.usage?.cost ?? 0,
    }

    return { text, usage, ...(toolCalls !== undefined && toolCalls.length > 0 ? { toolCalls } : {}) }
  }

  async embed(input: string[], model = 'openai/text-embedding-3-small'): Promise<EmbedResult> {
    const res = await fetch(`${BASE_URL}/embeddings`, {
      method: 'POST',
      headers: authHeaders(this.apiKey),
      body: JSON.stringify({ model, input }),
    })

    if (!res.ok) {
      throw new OpenRouterHttpError(res.status, await res.text())
    }

    const json = (await res.json()) as {
      data?: Array<{ embedding: number[]; index: number }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
    }

    const sorted = [...(json.data ?? [])].sort((a, b) => a.index - b.index)
    const embeddings = sorted.map((d) => d.embedding)

    const usage: OpenRouterUsage = {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
      costUsd: json.usage?.cost ?? 0,
    }

    return { embeddings, usage }
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatStreamEvent> {
    const body = { ...req, stream: true, usage: { include: true } }
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(this.apiKey),
      body: JSON.stringify(body),
    })

    if (!res.ok || res.body === null) {
      throw new OpenRouterHttpError(res.status, res.body === null ? 'no body' : await res.text())
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
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
  }
}
