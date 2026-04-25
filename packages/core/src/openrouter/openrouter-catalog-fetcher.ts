export interface OpenRouterModel {
  id: string
  name: string
  description: string
  createdByProvider: Date
  contextLength: number
  modality: string
  inputModalities: string[]
  tokenizer: string | null
  instructType: string | null
  inputUsdPerMillion: number
  outputUsdPerMillion: number
  imageUsdPerRequest: number | null
  maxOutputTokens: number | null
  isModerated: boolean
  expirationDate: string | null
  isFree: boolean
  supportsJsonSchema: boolean
}

interface RawModel {
  id: string
  name: string
  description?: string
  created?: number
  context_length?: number
  architecture?: {
    modality?: string
    input_modalities?: string[]
    tokenizer?: string
    instruct_type?: string | null
  }
  pricing?: {
    prompt?: string
    completion?: string
    image?: string
  }
  top_provider?: {
    max_completion_tokens?: number | null
    is_moderated?: boolean
  }
  supported_parameters?: string[]
  supported_features?: string[]
  expiration_date?: string | null
}

export function parseOpenRouterModels(payload: unknown): OpenRouterModel[] {
  const data = (payload as { data?: RawModel[] }).data ?? []
  const result: OpenRouterModel[] = []

  for (const m of data) {
    if (typeof m.id !== 'string' || typeof m.name !== 'string') continue

    const promptPerToken = parseFloat(m.pricing?.prompt ?? '0')
    const completionPerToken = parseFloat(m.pricing?.completion ?? '0')
    const imagePerRequest = m.pricing?.image ? parseFloat(m.pricing.image) : null
    const params = m.supported_parameters ?? m.supported_features ?? []

    result.push({
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      createdByProvider: new Date((m.created ?? 0) * 1000),
      contextLength: m.context_length ?? 0,
      modality: m.architecture?.modality ?? 'text->text',
      inputModalities: m.architecture?.input_modalities ?? ['text'],
      tokenizer: m.architecture?.tokenizer ?? null,
      instructType: m.architecture?.instruct_type ?? null,
      inputUsdPerMillion: promptPerToken * 1_000_000,
      outputUsdPerMillion: completionPerToken * 1_000_000,
      imageUsdPerRequest: imagePerRequest !== null && !isNaN(imagePerRequest) ? imagePerRequest : null,
      maxOutputTokens: m.top_provider?.max_completion_tokens ?? null,
      isModerated: m.top_provider?.is_moderated ?? false,
      expirationDate: m.expiration_date ?? null,
      isFree: promptPerToken === 0 && completionPerToken === 0,
      supportsJsonSchema: params.includes('structured_outputs') || params.includes('response_format'),
    })
  }

  return result
}

export async function fetchOpenRouterCatalog(apiKey: string): Promise<OpenRouterModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`OpenRouter /models failed: ${res.status} ${await res.text()}`)
  }

  return parseOpenRouterModels(await res.json())
}
