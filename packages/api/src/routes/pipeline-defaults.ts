import { eq } from 'drizzle-orm'
import type { PipelineModels, PipelinePromptVersions } from '@bedtime/core/pipeline/orchestrator'
import { db } from '@bedtime/core/db/client'
import { storyGroups, stories, appSettings } from '@bedtime/core/db/schema'
import { derivePerStageModels, type StageOverrides, type PerStageModels } from '@bedtime/core/pipeline/derivers/per-stage-models'
import { DEFAULT_STAGE_MODELS, isPipelineStage } from '@bedtime/core/pipeline/derivers/stage-defaults'

export async function loadStoryOverrides(storyId: number | null): Promise<StageOverrides | null> {
  if (storyId === null) return null

  const [row] = await db
    .select({ agentOverrides: stories.agentOverrides })
    .from(stories)
    .where(eq(stories.id, storyId))
    .limit(1)

  return (row?.agentOverrides as StageOverrides | null) ?? null
}

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

async function loadEffectiveDefaults(): Promise<PerStageModels> {
  const [row] = await db.select({ stageModels: appSettings.stageModels }).from(appSettings).where(eq(appSettings.id, 1)).limit(1)
  const globalOverrides = row?.stageModels ?? {}

  const effective = { ...DEFAULT_STAGE_MODELS } as Record<string, { model: string; fallback: string }>

  for (const [stage, override] of Object.entries(globalOverrides)) {
    if (isPipelineStage(stage) && override) {
      const o = override as { model?: string; fallback?: string }
      effective[stage] = {
        model: o.model ?? effective[stage]?.model ?? '',
        fallback: o.fallback ?? effective[stage]?.fallback ?? '',
      }
    }
  }

  return effective as PerStageModels
}

export async function resolvePipelineModels(
  universeId: number | null,
  perStoryOverrides: StageOverrides | null = null,
): Promise<PipelineModels> {
  const [universeRow, effectiveDefaults] = await Promise.all([
    universeId !== null
      ? db.select({ agentOverrides: storyGroups.agentOverrides }).from(storyGroups).where(eq(storyGroups.id, universeId)).limit(1)
      : Promise.resolve([]),
    loadEffectiveDefaults(),
  ])

  const universeOverrides = (universeRow[0]?.agentOverrides as StageOverrides | null) ?? null

  const resolved = derivePerStageModels({
    universeAgentOverrides: universeOverrides,
    perStoryOverrides,
    defaultFallbackMap: effectiveDefaults,
  })

  return {
    plotter: resolved.plotter.model,
    plotCritic: resolved.plotCritic.model,
    writer: resolved.writer.model,
    writerCritic: resolved.writerCritic.model,
  }
}
