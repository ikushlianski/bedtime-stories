import { describe, it, expect, vi } from 'vitest'

vi.mock('../db/client.js', () => {
  const insert = vi.fn(() => ({ values: insertValues }))
  const insertValues = vi.fn(async () => undefined)

  return {
    db: { insert },
    __mock: { insert, insertValues },
  }
})

import * as clientModule from '../db/client.js'
import { DbCostRecorder } from './cost-recorder'

const mocked = clientModule as unknown as {
  __mock: { insert: ReturnType<typeof vi.fn>; insertValues: ReturnType<typeof vi.fn> }
}

describe('DbCostRecorder', () => {
  it('writes a model_calls row per call', async () => {
    const recorder = new DbCostRecorder()

    await recorder.record({
      storyId: 7,
      stage: 'plotter',
      modelId: 'anthropic/claude-3.5-sonnet',
      attempt: 1,
      fallbackUsed: false,
      tokensIn: 1000,
      tokensOut: 200,
      usd: 0.012,
      latencyMs: 1500,
      success: true,
    })

    expect(mocked.__mock.insert).toHaveBeenCalledTimes(1)
    expect(mocked.__mock.insertValues).toHaveBeenCalledWith({
      storyId: 7,
      characterId: null,
      stage: 'plotter',
      modelId: 'anthropic/claude-3.5-sonnet',
      attempt: 1,
      fallbackUsed: false,
      tokensIn: 1000,
      tokensOut: 200,
      usdMicros: 12000,
      latencyMs: 1500,
      success: true,
    })
  })

  it('writes a model_calls row tied to a character instead of a story', async () => {
    const recorder = new DbCostRecorder()

    await recorder.record({
      storyId: null,
      characterId: 42,
      stage: 'character_portrait',
      modelId: 'google/gemini-2.5-flash-image',
      attempt: 1,
      fallbackUsed: false,
      tokensIn: 0,
      tokensOut: 0,
      usd: 0.0387509,
      latencyMs: 4200,
      success: true,
    })

    expect(mocked.__mock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ storyId: null, characterId: 42, stage: 'character_portrait' }),
    )
  })
})
