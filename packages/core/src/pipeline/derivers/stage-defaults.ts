import { PIPELINE_STAGES, type PerStageModels, type PipelineStage } from './per-stage-models.js'

const PRIMARY = 'deepseek/deepseek-v4-pro'
const FALLBACK = 'deepseek/deepseek-v4-flash'
const CHEAP_MODEL = 'deepseek/deepseek-v4-flash'

export const DEFAULT_STAGE_MODELS: PerStageModels = PIPELINE_STAGES.reduce((acc, stage) => {
  if (stage === 'ideaSuggester' || stage === 'illustrationMomentSelector') {
    acc[stage] = { model: CHEAP_MODEL, fallback: PRIMARY }
  } else {
    acc[stage] = { model: PRIMARY, fallback: FALLBACK }
  }
  return acc
}, {} as PerStageModels)

export function isPipelineStage(value: string): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes(value)
}
