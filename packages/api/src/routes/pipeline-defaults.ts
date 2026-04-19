import type { PipelineModels, PipelinePromptVersions } from '@bedtime/core/pipeline/orchestrator'

export const defaultModels: PipelineModels = {
  plotter: 'claude-opus-4-7',
  plotCritic: 'claude-sonnet-4-6',
  writer: 'claude-sonnet-4-6',
  writerCritic: 'claude-sonnet-4-6',
}

export const defaultPromptVersions: PipelinePromptVersions = {
  plotter: 1,
  plotCritic: 1,
  writer: 1,
  writerCritic: 1,
}
