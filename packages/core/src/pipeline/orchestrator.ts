import { runPlotter, PLOTTER_SYSTEM_PROMPT_DEFAULT } from './stages/plotter'
import { runPlotCritic } from './stages/plot-critic'
import { runWriter, WRITER_SYSTEM_PROMPT_DEFAULT } from './stages/writer'
import { runWriterCritic } from './stages/writer-critic'
import { runPlotterQuestions, type PlotterQuestionItem } from './stages/plotter-questions'
import { generateStoryTitle } from './stages/title-generator'
import { resolvePrompt, type ResolvedPrompt } from './prompt-resolver'
import type { CriticOutput } from './schemas'

const MAX_PLAN_ITERATIONS = 3

export interface PipelineModels {
  plotter: string
  plotCritic: string
  writer: string
  writerCritic: string
}

export interface PipelinePromptVersions {
  plotter: number
  plotCritic: number
  writer: number
  writerCritic: number
}

export interface PlanPhaseResult {
  planV1: string
  planFinal: string
  planIterationsCount: number
  titleSuggested: string
  plotCriticOutput: CriticOutput
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  sashaContext: string | null
}

export interface TextPhaseResult {
  textV1: string
  textV2: string
  writerCriticOutput: CriticOutput
  models: PipelineModels
  promptVersions: PipelinePromptVersions
}

export interface PipelineResult extends PlanPhaseResult, TextPhaseResult {}

export async function runPlanPhase(options: {
  seed: string
  storyId: number
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  userFeedback?: string
  cwd?: string
  onStepChange?: (step: string) => void
}): Promise<PlanPhaseResult> {
  const { seed, models } = options
  const notify = options.onStepChange ?? (() => undefined)
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const universeArg = options.universeSystemPrompt !== undefined
    ? { universeSystemPrompt: options.universeSystemPrompt }
    : {}
  const universeContextArg = options.universeContext !== undefined
    ? { universeContext: options.universeContext }
    : {}
  const styleGuideArg = options.styleGuide !== undefined
    ? { styleGuide: options.styleGuide }
    : {}
  const sashaContextArg = options.sashaContext !== undefined && options.sashaContext !== null
    ? { sashaContext: options.sashaContext }
    : {}

  const plotterPrompt = await resolvePrompt('plotter', PLOTTER_SYSTEM_PROMPT_DEFAULT, options.promptVersions.plotter)

  const resolvedVersions: PipelinePromptVersions = {
    ...options.promptVersions,
    plotter: plotterPrompt.version,
  }

  const userFeedbackArg = options.userFeedback ? { userFeedback: options.userFeedback } : {}

  notify('Plotter')
  const planV1 = await runPlotter({
    seed,
    model: models.plotter,
    resolvedPrompt: plotterPrompt,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
    ...userFeedbackArg,
  })

  let currentPlan = planV1
  let iterationsCount = 0
  let plotCriticOutput: CriticOutput | undefined

  for (let i = 0; i < MAX_PLAN_ITERATIONS; i++) {
    const iterationNumber = i + 1
    const isFinalIteration = i === MAX_PLAN_ITERATIONS - 1

    iterationsCount = iterationNumber

    notify('PlotCritic')
    plotCriticOutput = await runPlotCritic({
      plan: currentPlan,
      iterationNumber,
      model: models.plotCritic,
      ...cwdArg,
      ...universeArg,
      ...universeContextArg,
      ...styleGuideArg,
      ...sashaContextArg,
    })

    if (!plotCriticOutput.improvement_needed) {
      break
    }

    if (!isFinalIteration) {
      notify('Plotter')
      currentPlan = await runPlotter({
        seed,
        previousPlan: currentPlan,
        criticNotes: plotCriticOutput,
        model: models.plotter,
        resolvedPrompt: plotterPrompt,
        ...cwdArg,
        ...universeArg,
        ...universeContextArg,
        ...styleGuideArg,
        ...sashaContextArg,
      })
    }
  }

  if (plotCriticOutput === undefined) {
    throw new Error('Plan phase completed without critic output')
  }

  notify('TitleGenerator')
  const titleSuggested = await generateStoryTitle({
    plan: currentPlan,
    seed,
    model: models.plotter,
    ...cwdArg,
  })

  return {
    planV1,
    planFinal: currentPlan,
    planIterationsCount: iterationsCount,
    titleSuggested,
    plotCriticOutput,
    models,
    promptVersions: resolvedVersions,
    sashaContext: options.sashaContext ?? null,
  }
}

export async function runTextPhase(options: {
  seed: string
  planFinal: string
  storyId: number
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  cwd?: string
  onStepChange?: (step: string) => void
}): Promise<TextPhaseResult> {
  const { seed, planFinal, models } = options
  const notify = options.onStepChange ?? (() => undefined)
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const universeArg = options.universeSystemPrompt !== undefined
    ? { universeSystemPrompt: options.universeSystemPrompt }
    : {}
  const universeContextArg = options.universeContext !== undefined
    ? { universeContext: options.universeContext }
    : {}
  const styleGuideArg = options.styleGuide !== undefined
    ? { styleGuide: options.styleGuide }
    : {}
  const sashaContextArg = options.sashaContext !== undefined && options.sashaContext !== null
    ? { sashaContext: options.sashaContext }
    : {}

  const writerPrompt: ResolvedPrompt = await resolvePrompt(
    'writer',
    WRITER_SYSTEM_PROMPT_DEFAULT,
    options.promptVersions.writer,
  )

  const resolvedVersions: PipelinePromptVersions = {
    ...options.promptVersions,
    writer: writerPrompt.version,
  }

  notify('Writer')
  const textV1 = await runWriter({
    plan: planFinal,
    model: models.writer,
    resolvedPrompt: writerPrompt,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
  })

  notify('WriterCritic')
  const writerCriticOutput = await runWriterCritic({
    textV1,
    finalPlan: planFinal,
    model: models.writerCritic,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
  })

  notify('Improver')
  const textV2 = await runWriter({
    plan: planFinal,
    criticNotes: writerCriticOutput,
    model: models.writer,
    resolvedPrompt: writerPrompt,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
  })

  return {
    textV1,
    textV2,
    writerCriticOutput,
    models,
    promptVersions: resolvedVersions,
  }
}

export async function runQuestionsPhase(options: {
  seed: string
  storyId: number
  models: PipelineModels
  universeSystemPrompt?: string
  universeContext?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<PlotterQuestionItem[]> {
  const { seed, models } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const universeArg = options.universeSystemPrompt !== undefined
    ? { universeSystemPrompt: options.universeSystemPrompt }
    : {}
  const universeContextArg = options.universeContext !== undefined
    ? { universeContext: options.universeContext }
    : {}
  const sashaContextArg = options.sashaContext !== undefined && options.sashaContext !== null
    ? { sashaContext: options.sashaContext }
    : {}

  return runPlotterQuestions({
    seed,
    model: models.plotter,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...sashaContextArg,
  })
}

export async function runPipeline(options: {
  seed: string
  storyId: number
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<PipelineResult> {
  const planPhase = await runPlanPhase(options)

  const textPhase = await runTextPhase({
    seed: options.seed,
    planFinal: planPhase.planFinal,
    storyId: options.storyId,
    models: options.models,
    promptVersions: options.promptVersions,
    ...(options.universeSystemPrompt !== undefined ? { universeSystemPrompt: options.universeSystemPrompt } : {}),
    ...(options.universeContext !== undefined ? { universeContext: options.universeContext } : {}),
    ...(options.styleGuide !== undefined ? { styleGuide: options.styleGuide } : {}),
    ...(options.sashaContext !== undefined ? { sashaContext: options.sashaContext } : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
  })

  return { ...planPhase, ...textPhase }
}
