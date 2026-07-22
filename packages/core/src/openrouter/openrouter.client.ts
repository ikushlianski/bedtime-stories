const BASE_URL = 'https://openrouter.ai/api/v1'

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

export interface ImageGenerationReference {
  base64: string
  mediaType: string
}

export interface ImageGenerationRequest {
  model: string
  prompt: string
  referenceImages?: ImageGenerationReference[]
}

export interface ImageGenerationResult {
  imageBase64: string
  mediaType: string
  usage: OpenRouterUsage
}

export class ImageModerationRefusedError extends Error {
  constructor(readonly body: string) {
    super(`OpenRouter refused to generate an image: ${body.slice(0, 500)}`)
  }
}

function isModerationRefusalBody(body: string): boolean {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } }
    return typeof parsed.error?.message === 'string' && /no image data/i.test(parsed.error.message)
  } catch {
    return false
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
    const body = { ...req, stream: false }
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(this.apiKey),
      body: JSON.stringify(body),
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
  }

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const inputReferences =
      req.referenceImages !== undefined && req.referenceImages.length > 0
        ? req.referenceImages.map((reference) => ({
            type: 'image_url',
            image_url: {
              url: `data:${reference.mediaType};base64,${reference.base64}`,
            },
          }))
        : undefined

    const res = await fetch(`${BASE_URL}/images`, {
      method: 'POST',
      headers: authHeaders(this.apiKey),
      body: JSON.stringify({
        model: req.model,
        prompt: req.prompt,
        n: 1,
        ...(inputReferences !== undefined ? { input_references: inputReferences } : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text()

      if (res.status === 400 && isModerationRefusalBody(body)) {
        throw new ImageModerationRefusedError(body)
      }

      throw new OpenRouterHttpError(res.status, body)
    }

    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; media_type?: string }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
    }

    const image = json.data?.[0]

    if (!image?.b64_json) {
      throw new ImageModerationRefusedError(JSON.stringify(json))
    }

    return {
      imageBase64: image.b64_json,
      mediaType: image.media_type ?? 'image/png',
      usage: {
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
        costUsd: json.usage?.cost ?? 0,
      },
    }
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
