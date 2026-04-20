import type { PlanPhaseResult, TextPhaseResult, PlotterOnlyResult, WriterOnlyResult, TextCritiqueResult } from '@bedtime/core/pipeline/orchestrator'
import type { NewRunSnapshot } from '@bedtime/core/db/types'

export function buildPlanSnapshotInsert(storyId: number, plan: PlanPhaseResult): NewRunSnapshot {
  return {
    storyId,
    plotterModel: plan.models.plotter,
    plotterPromptVersion: plan.promptVersions.plotter,
    psychologistPlanModel: null,
    psychologistPlanPromptVersion: null,
    plotCriticModel: plan.models.plotCritic,
    plotCriticPromptVersion: plan.promptVersions.plotCritic,
    planIterationsCount: plan.planIterationsCount,
    planV1: plan.planV1,
    planFinal: plan.planFinal,
    psychologistPlanOutput: null,
    plotCriticOutput: plan.plotCriticOutput,
    sashaContext: plan.sashaContext ?? undefined,
  }
}

export function buildTextSnapshotUpdate(text: TextPhaseResult): Partial<NewRunSnapshot> {
  return {
    writerModel: text.models.writer,
    writerPromptVersion: text.promptVersions.writer,
    psychologistTextModel: null,
    psychologistTextPromptVersion: null,
    writerCriticModel: text.models.writerCritic,
    writerCriticPromptVersion: text.promptVersions.writerCritic,
    textV1: text.textV1,
    textV2: text.textV2,
    psychologistTextOutput: null,
    writerCriticOutput: text.writerCriticOutput,
  }
}

export interface PlanStoriesUpdate {
  title: string
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
    title: plan.titleSuggested,
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

export interface PlotterOnlyStoriesUpdate {
  title: string
  planV1: string
  plotterModel: string
  plotterPromptVersion: number
}

export function buildPlotterOnlyStoriesUpdate(result: PlotterOnlyResult): PlotterOnlyStoriesUpdate {
  return {
    title: result.titleSuggested,
    planV1: result.planV1,
    plotterModel: result.models.plotter,
    plotterPromptVersion: result.promptVersions.plotter,
  }
}

export function buildPlotterOnlySnapshotInsert(storyId: number, result: PlotterOnlyResult): NewRunSnapshot {
  return {
    storyId,
    plotterModel: result.models.plotter,
    plotterPromptVersion: result.promptVersions.plotter,
    psychologistPlanModel: null,
    psychologistPlanPromptVersion: null,
    plotCriticModel: null,
    plotCriticPromptVersion: null,
    planIterationsCount: 1,
    planV1: result.planV1,
    planFinal: null,
    psychologistPlanOutput: null,
    plotCriticOutput: null,
    sashaContext: result.sashaContext ?? undefined,
  }
}

export interface WriterOnlyStoriesUpdate {
  textV1: string
  writerModel: string
  writerPromptVersion: number
}

export function buildWriterOnlyStoriesUpdate(result: WriterOnlyResult): WriterOnlyStoriesUpdate {
  return {
    textV1: result.textV1,
    writerModel: result.models.writer,
    writerPromptVersion: result.promptVersions.writer,
  }
}

export interface TextCritiqueStoriesUpdate {
  textV2: string
  writerCriticModel: string
  writerCriticPromptVersion: number
}

export function buildTextCritiqueStoriesUpdate(result: TextCritiqueResult): TextCritiqueStoriesUpdate {
  return {
    textV2: result.textV2,
    writerCriticModel: result.models.writerCritic,
    writerCriticPromptVersion: result.promptVersions.writerCritic,
  }
}

export function buildTextCritiqueSnapshotUpdate(result: TextCritiqueResult): Partial<NewRunSnapshot> {
  return {
    writerCriticModel: result.models.writerCritic,
    writerCriticPromptVersion: result.promptVersions.writerCritic,
    textV2: result.textV2,
    writerCriticOutput: result.writerCriticOutput,
  }
}
