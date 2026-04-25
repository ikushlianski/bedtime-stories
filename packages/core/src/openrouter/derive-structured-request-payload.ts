import { z } from 'zod'

const JSON_ONLY_SUFFIX =
  '\n\nIMPORTANT: Respond with a single JSON value that matches the requested schema. No prose, no explanation, no markdown fences.'

export interface StructuredRequestInput<T> {
  model: string
  supportsJsonSchema: boolean
  systemPrompt: string
  userPrompt: string
  schema: z.ZodType<T>
  schemaName?: string
}

export interface StructuredRequestPayload {
  model: string
  messages: Array<{ role: 'system' | 'user'; content: string }>
  stream: false
  response_format?: {
    type: 'json_schema'
    json_schema: { name: string; schema: Record<string, unknown>; strict: true }
  }
}

export function deriveStructuredRequestPayload<T>(input: StructuredRequestInput<T>): StructuredRequestPayload {
  const useNative = input.supportsJsonSchema
  const systemPrompt = useNative ? input.systemPrompt : `${input.systemPrompt}${JSON_ONLY_SUFFIX}`

  const payload: StructuredRequestPayload = {
    model: input.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input.userPrompt },
    ],
    stream: false,
  }

  if (useNative) {
    const schemaJson = z.toJSONSchema(input.schema as z.ZodType) as Record<string, unknown>

    payload.response_format = {
      type: 'json_schema',
      json_schema: { name: input.schemaName ?? 'result', schema: schemaJson, strict: true },
    }
  }

  return payload
}
