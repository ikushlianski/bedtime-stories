import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenRouterClient, OpenRouterHttpError, ImageModerationRefusedError } from './openrouter.client'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('OpenRouterClient.generateImage', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the generated image bytes, media type, and usage on success', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        data: [{ b64_json: 'aGVsbG8=', media_type: 'image/png' }],
        usage: { prompt_tokens: 23, completion_tokens: 1290, cost: 0.0387069 },
      }),
    )

    const client = new OpenRouterClient('test-key')
    const result = await client.generateImage({ model: 'google/gemini-2.5-flash-image', prompt: 'a fox reading' })

    expect(result).toEqual({
      imageBase64: 'aGVsbG8=',
      mediaType: 'image/png',
      usage: { promptTokens: 23, completionTokens: 1290, costUsd: 0.0387069 },
    })
  })

  it('sends a single reference image as an image_url data URL when provided', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: [{ b64_json: 'aGVsbG8=', media_type: 'image/png' }], usage: {} }),
    )

    const client = new OpenRouterClient('test-key')
    await client.generateImage({
      model: 'google/gemini-2.5-flash-image',
      prompt: 'the same fox waving',
      referenceImages: [{ base64: 'cmVmZXJlbmNl', mediaType: 'image/png' }],
    })

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    const sentBody = JSON.parse(init.body) as { input_references: Array<{ image_url: { url: string } }> }

    expect(sentBody.input_references[0]?.image_url.url).toBe('data:image/png;base64,cmVmZXJlbmNl')
  })

  it('sends multiple reference images, one per named character', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: [{ b64_json: 'aGVsbG8=', media_type: 'image/png' }], usage: {} }),
    )

    const client = new OpenRouterClient('test-key')
    await client.generateImage({
      model: 'google/gemini-2.5-flash-image',
      prompt: 'two friends waving',
      referenceImages: [
        { base64: 'Zmlyc3Q=', mediaType: 'image/png' },
        { base64: 'c2Vjb25k', mediaType: 'image/jpeg' },
      ],
    })

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    const sentBody = JSON.parse(init.body) as { input_references: Array<{ image_url: { url: string } }> }

    expect(sentBody.input_references).toHaveLength(2)
    expect(sentBody.input_references[0]?.image_url.url).toBe('data:image/png;base64,Zmlyc3Q=')
    expect(sentBody.input_references[1]?.image_url.url).toBe('data:image/jpeg;base64,c2Vjb25k')
  })

  it('omits input_references when referenceImages is an empty array', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: [{ b64_json: 'aGVsbG8=', media_type: 'image/png' }], usage: {} }),
    )

    const client = new OpenRouterClient('test-key')
    await client.generateImage({ model: 'google/gemini-2.5-flash-image', prompt: 'a fox reading', referenceImages: [] })

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    const sentBody = JSON.parse(init.body) as Record<string, unknown>

    expect(sentBody['input_references']).toBeUndefined()
  })

  it('omits input_references entirely when no reference image is provided', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: [{ b64_json: 'aGVsbG8=', media_type: 'image/png' }], usage: {} }),
    )

    const client = new OpenRouterClient('test-key')
    await client.generateImage({ model: 'google/gemini-2.5-flash-image', prompt: 'a fox reading' })

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }]
    const sentBody = JSON.parse(init.body) as Record<string, unknown>

    expect(sentBody['input_references']).toBeUndefined()
  })

  it('throws ImageModerationRefusedError when the API reports no image data on a 400', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: { message: 'Gemini returned no image data (finish_reason: STOP)', code: 400 },
      }),
    )

    const client = new OpenRouterClient('test-key')

    await expect(
      client.generateImage({ model: 'google/gemini-2.5-flash-image', prompt: 'a scary graphic scene' }),
    ).rejects.toThrow(ImageModerationRefusedError)
  })

  it('throws OpenRouterHttpError for a validation error that is not a moderation refusal', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { success: false, error: { name: 'ZodError', message: 'Invalid input' } }),
    )

    const client = new OpenRouterClient('test-key')

    await expect(
      client.generateImage({ model: 'google/gemini-2.5-flash-image', prompt: '' }),
    ).rejects.toThrow(OpenRouterHttpError)
  })

  it('throws OpenRouterHttpError for a transient 503', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { error: { message: 'upstream unavailable' } }))

    const client = new OpenRouterClient('test-key')

    await expect(
      client.generateImage({ model: 'google/gemini-2.5-flash-image', prompt: 'a fox reading' }),
    ).rejects.toThrow(OpenRouterHttpError)
  })
})
