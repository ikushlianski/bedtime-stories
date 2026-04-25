import { db } from '../db/client.js'
import { modelCalls } from '../db/schema.js'

export interface RecordCallInput {
  storyId: number | null
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
      await db.insert(modelCalls).values({
        storyId: input.storyId,
        stage: input.stage,
        modelId: input.modelId,
        attempt: input.attempt,
        fallbackUsed: input.fallbackUsed,
        tokensIn: input.tokensIn,
        tokensOut: input.tokensOut,
        usd: input.usd.toString(),
        latencyMs: input.latencyMs,
        success: input.success,
      })
    } catch (err) {
      console.error('[cost-recorder] failed to record model call', err)
    }
  }
}

export const costRecorder: CostRecorder = new DbCostRecorder()
