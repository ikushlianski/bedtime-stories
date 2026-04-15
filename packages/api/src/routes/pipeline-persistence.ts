import type { PlanPhaseResult, TextPhaseResult } from '@bedtime/core/pipeline/orchestrator'
import type { NewRunSnapshot } from '@bedtime/core/db/types'

export function buildPlanSnapshotInsert(storyId: number, plan: PlanPhaseResult): NewRunSnapshot {
  return {
    storyId,
    plotterModel: plan.models.plotter,
    plotterPromptVersion: plan.promptVersions.plotter,
    psychologistPlanModel: plan.models.psychologist,
    psychologistPlanPromptVersion: plan.promptVersions.psychologistPlan,
    plotCriticModel: plan.models.plotCritic,
    plotCriticPromptVersion: plan.promptVersions.plotCritic,
    planIterationsCount: plan.planIterationsCount,
    planV1: plan.planV1,
    planFinal: plan.planFinal,
    psychologistPlanOutput: plan.psychologistPlanOutput,
    plotCriticOutput: plan.plotCriticOutput,
    sashaContext: plan.sashaContext ?? undefined,
  }
}

export function buildTextSnapshotUpdate(text: TextPhaseResult): Partial<NewRunSnapshot> {
  return {
    writerModel: text.models.writer,
    writerPromptVersion: text.promptVersions.writer,
    psychologistTextModel: text.models.psychologist,
    psychologistTextPromptVersion: text.promptVersions.psychologistText,
    writerCriticModel: text.models.writerCritic,
    writerCriticPromptVersion: text.promptVersions.writerCritic,
    textV1: text.textV1,
    textV2: text.textV2,
    psychologistTextOutput: text.psychologistTextOutput,
    writerCriticOutput: text.writerCriticOutput,
  }
}

export interface PlanStoriesUpdate {
  planV1: string
  planFinal: string
  planIterations: number
  plotterModel: string
  plotterPromptVersion: number
  plotCriticModel: string
  plotCriticPromptVersion: number
}

export function buildPlanStoriesUpdate(plan: PlanPhaseResult): PlanStoriesUpdate {
  return {
    planV1: plan.planV1,
    planFinal: plan.planFinal,
    planIterations: plan.planIterationsCount,
    plotterModel: plan.models.plotter,
    plotterPromptVersion: plan.promptVersions.plotter,
    plotCriticModel: plan.models.plotCritic,
    plotCriticPromptVersion: plan.promptVersions.plotCritic,
  }
}

export interface TextStoriesUpdate {
  textV1: string
  textV2: string
  writerModel: string
  writerPromptVersion: number
  writerCriticModel: string
  writerCriticPromptVersion: number
}

export function buildTextStoriesUpdate(text: TextPhaseResult): TextStoriesUpdate {
  return {
    textV1: text.textV1,
    textV2: text.textV2,
    writerModel: text.models.writer,
    writerPromptVersion: text.promptVersions.writer,
    writerCriticModel: text.models.writerCritic,
    writerCriticPromptVersion: text.promptVersions.writerCritic,
  }
}
