import type { PipelineModels, PipelinePromptVersions } from '@bedtime/core/pipeline/orchestrator'

export const defaultModels: PipelineModels = {
  plotter: 'claude-sonnet-4-6',
  psychologist: 'claude-sonnet-4-6',
  plotCritic: 'claude-haiku-4-5-20251001',
  writer: 'claude-sonnet-4-6',
  writerCritic: 'claude-haiku-4-5-20251001',
}

export const defaultPromptVersions: PipelinePromptVersions = {
  plotter: 1,
  psychologistPlan: 1,
  psychologistText: 1,
  plotCritic: 1,
  writer: 1,
  writerCritic: 1,
}
