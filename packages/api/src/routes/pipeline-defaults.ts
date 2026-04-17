import type { PipelineModels, PipelinePromptVersions } from '@bedtime/core/pipeline/orchestrator'

export const defaultModels: PipelineModels = {
  plotter: 'claude-opus-4-6',
  psychologist: 'claude-opus-4-6',
  plotCritic: 'claude-opus-4-6',
  writer: 'claude-opus-4-6',
  writerCritic: 'claude-opus-4-6',
}

export const defaultPromptVersions: PipelinePromptVersions = {
  plotter: 1,
  psychologistPlan: 1,
  psychologistText: 1,
  plotCritic: 1,
  writer: 1,
  writerCritic: 1,
}
