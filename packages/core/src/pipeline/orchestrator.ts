import { runPlotter } from './stages/plotter'
import { runPsychologist } from './stages/psychologist'
import { runPlotCritic } from './stages/plot-critic'
import { runWriter } from './stages/writer'
import { runWriterCritic } from './stages/writer-critic'
import type { PsychologistOutput, CriticOutput } from './schemas'

const MAX_PLAN_ITERATIONS = 3

export interface PipelineResult {
  planV1: string
  planFinal: string
  planIterationsCount: number
  psychologistPlanOutput: PsychologistOutput
  plotCriticOutput: CriticOutput
  textV1: string
  textV2: string
  psychologistTextOutput: PsychologistOutput
  writerCriticOutput: CriticOutput
  models: {
    plotter: string
    psychologist: string
    plotCritic: string
    writer: string
    writerCritic: string
  }
  promptVersions: {
    plotter: number
    psychologistPlan: number
    psychologistText: number
    plotCritic: number
    writer: number
    writerCritic: number
  }
}

export async function runPipeline(options: {
  seed: string
  storyId: number
  models: {
    plotter: string
    psychologist: string
    plotCritic: string
    writer: string
    writerCritic: string
  }
  promptVersions: {
    plotter: number
    psychologistPlan: number
    psychologistText: number
    plotCritic: number
    writer: number
    writerCritic: number
  }
  cwd?: string
}): Promise<PipelineResult> {
  const { seed, models, promptVersions } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const planV1 = await runPlotter({
    seed,
    model: models.plotter,
    promptVersion: promptVersions.plotter,
    ...cwdArg,
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
      const psych = await runPsychologist({
        content: currentPlan,
        contentType: 'plan',
        seed,
        iterationNumber,
        model: models.psychologist,
        ...cwdArg,
      })

      psychologistPlanOutput = psych

      plotCriticOutput = await runPlotCritic({
        plan: currentPlan,
        psychologistOutput: psych,
        iterationNumber,
        model: models.plotCritic,
        ...cwdArg,
      })
    } else {
      plotCriticOutput = await runPlotCritic({
        plan: currentPlan,
        psychologistOutput: psychologistPlanOutput!,
        iterationNumber,
        model: models.plotCritic,
        ...cwdArg,
      })
    }

    if (!plotCriticOutput.improvement_needed) {
      break
    }

    if (!isFinalIteration) {
      currentPlan = await runPlotter({
        seed,
        previousPlan: currentPlan,
        criticNotes: plotCriticOutput,
        model: models.plotter,
        promptVersion: promptVersions.plotter,
        ...cwdArg,
      })
    }
  }

  const planFinal = currentPlan

  const textV1 = await runWriter({
    plan: planFinal,
    model: models.writer,
    promptVersion: promptVersions.writer,
    ...cwdArg,
  })

  const psychologistTextOutput = await runPsychologist({
    content: textV1,
    contentType: 'text',
    seed,
    iterationNumber: 1,
    model: models.psychologist,
    ...cwdArg,
  })

  const writerCriticOutput = await runWriterCritic({
    textV1,
    psychologistOutput: psychologistTextOutput,
    finalPlan: planFinal,
    model: models.writerCritic,
    ...cwdArg,
  })

  const textV2 = await runWriter({
    plan: planFinal,
    criticNotes: writerCriticOutput,
    model: models.writer,
    promptVersion: promptVersions.writer,
    ...cwdArg,
  })

  return {
    planV1,
    planFinal,
    planIterationsCount: iterationsCount,
    psychologistPlanOutput: psychologistPlanOutput!,
    plotCriticOutput: plotCriticOutput!,
    textV1,
    textV2,
    psychologistTextOutput,
    writerCriticOutput,
    models,
    promptVersions,
  }
}
