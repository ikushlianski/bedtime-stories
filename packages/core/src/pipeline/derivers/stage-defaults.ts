import { PIPELINE_STAGES, type PerStageModels, type PipelineStage } from './per-stage-models.js'

const PRIMARY = 'anthropic/claude-sonnet-4'
const FALLBACK = 'anthropic/claude-3.5-haiku'
const CHEAP_MODEL = 'deepseek/deepseek-chat'

export const DEFAULT_STAGE_MODELS: PerStageModels = PIPELINE_STAGES.reduce((acc, stage) => {
  if (stage === 'ideaSuggester') {
    acc[stage] = { model: CHEAP_MODEL, fallback: PRIMARY }
  } else {
    acc[stage] = { model: PRIMARY, fallback: FALLBACK }
  }
  return acc
}, {} as PerStageModels)

export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value)
}
