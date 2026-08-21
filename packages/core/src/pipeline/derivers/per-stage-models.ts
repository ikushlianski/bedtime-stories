export const PIPELINE_STAGES = [
  'plotter',
  'plotCritic',
  'writer',
  'writerCritic',
  'psychologistPlan',
  'psychologistText',
  'plotterQuestions',
  'improver',
  'titleGenerator',
  'storyAnalyzer',
  'universeFactExtractor',
  'feedbackSynthesizer',
  'styleGuideUpdater',
  'universeContextUpdater',
  'ideaSuggester',
  'illustrationMomentSelector',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export interface StageModelChoice {
  model: string
  fallback: string
}

export type PerStageModels = Record<PipelineStage, StageModelChoice>

export type StageOverrides = Partial<Record<PipelineStage, Partial<StageModelChoice>>>

export function derivePerStageModels(input: {
  universeAgentOverrides: StageOverrides | null | undefined
  perStoryOverrides: StageOverrides | null | undefined
  defaultFallbackMap: PerStageModels
}): PerStageModels {
  const universe = input.universeAgentOverrides ?? {}
  const story = input.perStoryOverrides ?? {}
  const result = {} as PerStageModels

  for (const stage of PIPELINE_STAGES) {
    const def = input.defaultFallbackMap[stage]
    const u = universe[stage] ?? {}
    const s = story[stage] ?? {}

    result[stage] = {
      model: s.model ?? u.model ?? def.model,
      fallback: s.fallback ?? u.fallback ?? def.fallback,
    }
  }

  return result
}
