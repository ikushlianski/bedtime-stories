import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { deriveStructuredRequestPayload } from './derive-structured-request-payload'

const schema = z.object({ verdict: z.string() })

describe('deriveStructuredRequestPayload', () => {
  it('includes response_format when model supports json_schema', () => {
    const payload = deriveStructuredRequestPayload({
      model: 'openai/gpt-4o',
      supportsJsonSchema: true,
      systemPrompt: 'You are a critic.',
      userPrompt: 'Critique this plan.',
      schema,
      schemaName: 'critique',
    })

    expect(payload.response_format).toBeDefined()
    expect(payload.response_format?.type).toBe('json_schema')
    expect(payload.response_format?.json_schema.name).toBe('critique')
    expect(payload.messages[0]?.content).toBe('You are a critic.')
  })

  it('omits response_format and appends JSON-only instruction when model lacks json_schema', () => {
    const payload = deriveStructuredRequestPayload({
      model: 'meta/llama',
      supportsJsonSchema: false,
      systemPrompt: 'You are a critic.',
      userPrompt: 'Critique this plan.',
      schema,
    })

    expect(payload.response_format).toBeUndefined()
    expect(payload.messages[0]?.content).toContain('You are a critic.')
    expect(payload.messages[0]?.content).toContain('JSON value')
  })

  it('passes through user prompt and model unchanged', () => {
    const payload = deriveStructuredRequestPayload({
      model: 'm',
      supportsJsonSchema: true,
      systemPrompt: 'sys',
      userPrompt: 'user-input',
      schema,
    })

    expect(payload.model).toBe('m')
    expect(payload.messages[1]).toEqual({ role: 'user', content: 'user-input' })
    expect(payload.stream).toBe(false)
  })
})
