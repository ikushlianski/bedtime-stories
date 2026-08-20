import { db } from '../db/client.js'
import { modelCalls } from '../db/schema.js'
import { toMicros } from '@bedtime/shared/money/micros'

export interface RecordCallInput {
  storyId: number | null
  characterId?: number | null
  stage: string
  modelId: string
  attempt: number
  fallbackUsed: boolean
  tokensIn: number
  tokensOut: number
  usd: number
  latencyMs: number
  success: boolean
}

export interface CostRecorder {
  record(input: RecordCallInput): Promise<void>
}

export class DbCostRecorder implements CostRecorder {
  async record(input: RecordCallInput): Promise<void> {
    try {
      const usdMicros = toMicros(input.usd)

      if (usdMicros === null) {
        console.error(
          `[cost-recorder] invalid usd value for model=${input.modelId} stage=${input.stage} story=${input.storyId} usd=${JSON.stringify(input.usd)} — recording call with null cost`,
        )
      }

      await db.insert(modelCalls).values({
        storyId: input.storyId,
        characterId: input.characterId ?? null,
        stage: input.stage,
        modelId: input.modelId,
        attempt: input.attempt,
        fallbackUsed: input.fallbackUsed,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        usdMicros,
        latencyMs: input.latencyMs,
        success: input.success,
      })
    } catch (err) {
      console.error('[cost-recorder] failed to record model call', err)
    }
  }
}

export const costRecorder: CostRecorder = new DbCostRecorder()
