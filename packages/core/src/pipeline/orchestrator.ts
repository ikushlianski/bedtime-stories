import { runPlotter, PLOTTER_SYSTEM_PROMPT_DEFAULT } from './stages/plotter'
import { runPsychologist } from './stages/psychologist'
import { runPlotCritic } from './stages/plot-critic'
import { runWriter, WRITER_SYSTEM_PROMPT_DEFAULT } from './stages/writer'
import { runWriterCritic } from './stages/writer-critic'
import { runPlotterQuestions, type PlotterQuestionItem } from './stages/plotter-questions'
import { generateStoryTitle } from './stages/title-generator'
import { resolvePrompt, type ResolvedPrompt } from './prompt-resolver'
import type { PsychologistOutput, CriticOutput } from './schemas'

const MAX_PLAN_ITERATIONS = 3

export interface PipelineModels {
  plotter: string
  psychologist: string
  plotCritic: string
  writer: string
  writerCritic: string
}

export interface PipelinePromptVersions {
  plotter: number
  psychologistPlan: number
  psychologistText: number
  plotCritic: number
  writer: number
  writerCritic: number
}

export interface PlanPhaseResult {
  planV1: string
  planFinal: string
  planIterationsCount: number
  titleSuggested: string
  psychologistPlanOutput: PsychologistOutput
  plotCriticOutput: CriticOutput
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  sashaContext: string | null
}

export interface TextPhaseResult {
  textV1: string
  textV2: string
  psychologistTextOutput: PsychologistOutput
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
    ...sashaContextArg,
    ...userFeedbackArg,
  })

  let currentPlan = planV1
  let iterationsCount = 0
  let psychologistPlanOutput: PsychologistOutput | undefined
  let plotCriticOutput: CriticOutput | undefined

  for (let i = 0; i < MAX_PLAN_ITERATIONS; i++) {
    const iterationNumber = i + 1
    const isFinalIteration = i === MAX_PLAN_ITERATIONS - 1
    const isFirstIteration = i === 0

    iterationsCount = iterationNumber

    if (isFirstIteration || isFinalIteration) {
      notify('Psychologist')
      const psych = await runPsychologist({
        content: currentPlan,
        contentType: 'plan',
        seed,
        iterationNumber,
        model: models.psychologist,
        ...cwdArg,
        ...universeArg,
        ...sashaContextArg,
      })

      psychologistPlanOutput = psych

      notify('PlotCritic')
      plotCriticOutput = await runPlotCritic({
        plan: currentPlan,
        psychologistOutput: psych,
        iterationNumber,
        model: models.plotCritic,
        ...cwdArg,
        ...universeArg,
        ...sashaContextArg,
      })
    } else {
      if (psychologistPlanOutput === undefined) {
        throw new Error('Invariant violated: psychologistPlanOutput missing on intermediate iteration')
      }

      notify('PlotCritic')
      plotCriticOutput = await runPlotCritic({
        plan: currentPlan,
        psychologistOutput: psychologistPlanOutput,
        iterationNumber,
        model: models.plotCritic,
        ...cwdArg,
        ...universeArg,
        ...sashaContextArg,
      })
    }

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
        ...sashaContextArg,
      })
    }
  }

  if (psychologistPlanOutput === undefined || plotCriticOutput === undefined) {
    throw new Error('Plan phase completed without psychologist or critic output')
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
    psychologistPlanOutput,
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
    ...sashaContextArg,
  })

  notify('Psychologist')
  const psychologistTextOutput = await runPsychologist({
    content: textV1,
    contentType: 'text',
    seed,
    iterationNumber: 1,
    model: models.psychologist,
    ...cwdArg,
    ...universeArg,
    ...sashaContextArg,
  })

  notify('WriterCritic')
  const writerCriticOutput = await runWriterCritic({
    textV1,
    psychologistOutput: psychologistTextOutput,
    finalPlan: planFinal,
    model: models.writerCritic,
    ...cwdArg,
    ...universeArg,
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
    ...sashaContextArg,
  })

  return {
    textV1,
    textV2,
    psychologistTextOutput,
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
  sashaContext?: string | null
  cwd?: string
}): Promise<PlotterQuestionItem[]> {
  const { seed, models } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const universeArg = options.universeSystemPrompt !== undefined
    ? { universeSystemPrompt: options.universeSystemPrompt }
    : {}
  const sashaContextArg = options.sashaContext !== undefined && options.sashaContext !== null
    ? { sashaContext: options.sashaContext }
    : {}

  return runPlotterQuestions({
    seed,
    model: models.plotter,
    ...cwdArg,
    ...universeArg,
    ...sashaContextArg,
  })
}

export async function runPipeline(options: {
  seed: string
  storyId: number
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
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
    ...(options.sashaContext !== undefined ? { sashaContext: options.sashaContext } : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
  })

  return { ...planPhase, ...textPhase }
}
