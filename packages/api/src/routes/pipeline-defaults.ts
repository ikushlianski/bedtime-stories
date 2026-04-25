import { eq } from 'drizzle-orm'
import type { PipelineModels, PipelinePromptVersions } from '@bedtime/core/pipeline/orchestrator'
import { db } from '@bedtime/core/db/client'
import { storyGroups } from '@bedtime/core/db/schema'
import { derivePerStageModels, type StageOverrides } from '@bedtime/core/pipeline/derivers/per-stage-models'
import { DEFAULT_STAGE_MODELS } from '@bedtime/core/pipeline/derivers/stage-defaults'

export const defaultModels: PipelineModels = {
  plotter: DEFAULT_STAGE_MODELS.plotter.model,
  plotCritic: DEFAULT_STAGE_MODELS.plotCritic.model,
  writer: DEFAULT_STAGE_MODELS.writer.model,
  writerCritic: DEFAULT_STAGE_MODELS.writerCritic.model,
}

export const defaultPromptVersions: PipelinePromptVersions = {
  plotter: 1,
  plotCritic: 1,
  writer: 1,
  writerCritic: 1,
}

export async function resolvePipelineModels(universeId: number | null): Promise<PipelineModels> {
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

  return {
    plotter: resolved.plotter.model,
    plotCritic: resolved.plotCritic.model,
    writer: resolved.writer.model,
    writerCritic: resolved.writerCritic.model,
  }
}
