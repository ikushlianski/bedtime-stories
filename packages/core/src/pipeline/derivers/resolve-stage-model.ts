import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { storyGroups } from '../../db/schema.js'
import { derivePerStageModels, type PipelineStage, type StageModelChoice, type StageOverrides } from './per-stage-models.js'
import { DEFAULT_STAGE_MODELS } from './stage-defaults.js'

export async function resolveStageModel(universeId: number | null, stage: PipelineStage): Promise<StageModelChoice> {
  let universeOverrides: StageOverrides | null = null

  if (universeId !== null) {
    const [row] = await db
      .select({ agentOverrides: storyGroups.agentOverrides })
      .from(storyGroups)
      .where(eq(storyGroups.id, universeId))
      .limit(1)

    universeOverrides = (row?.agentOverrides as StageOverrides | null) ?? null
  }

  const resolved = derivePerStageModels({
    universeAgentOverrides: universeOverrides,
    perStoryOverrides: null,
    defaultFallbackMap: DEFAULT_STAGE_MODELS,
  })

  return resolved[stage]
}
