import { runPlotter, PLOTTER_SYSTEM_PROMPT_DEFAULT } from './stages/plotter'
import { runWriter, WRITER_SYSTEM_PROMPT_DEFAULT } from './stages/writer'
import { runPlotterQuestions, type PlotterQuestionItem } from './stages/plotter-questions'
import { generateStoryTitle } from './stages/title-generator'
import { resolvePrompt, type ResolvedPrompt } from './prompt-resolver'
import { loadEligibleFragments, extractFragmentMarkers, MAX_FRAGMENTS_PER_STORY } from './load-fragments'
import type { CriticOutput } from './schemas'
import type { Exemplar } from './load-exemplars'
import { withPipelineTrace, withPipelineTraceIfNone, addStoryContext } from '@bedtime/observability'

export interface PipelineModels {
  plotter: string
  plotCritic: string
  writer: string
  writerCritic: string
  plotterQuestions: string
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
  usedFragmentIds: number[]
}

export interface PlotterOnlyResult {
  planV1: string
  titleSuggested: string
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  sashaContext: string | null
  usedFragmentIds: number[]
}

export interface WriterOnlyResult {
  textV1: string
  models: PipelineModels
  promptVersions: PipelinePromptVersions
}

export interface TextCritiqueResult {
  textV2: string
  writerCriticOutput: CriticOutput
  models: PipelineModels
  promptVersions: PipelinePromptVersions
}

export interface AnnotatedRewriteResult {
  textV2: string
  models: PipelineModels
  promptVersions: PipelinePromptVersions
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
  universeId?: number | null
  injectFragments?: boolean
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
  const storyIdArg = { storyId: options.storyId }

  const eligibleFragments = options.injectFragments
    ? await loadEligibleFragments(options.universeId ?? null)
    : []
  const fragmentsArg = eligibleFragments.length > 0 ? { eligibleFragments } : {}

  notify('Plotter')
  const planRaw = await runPlotter({
    seed,
    model: models.plotter,
    resolvedPrompt: plotterPrompt,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
    ...fragmentsArg,
    ...userFeedbackArg,
    ...storyIdArg,
  })

  const marker = extractFragmentMarkers(planRaw)
  const planV1 = marker.cleanedText
  const eligibleIds = new Set(eligibleFragments.map((f) => f.id))
  const usedFragmentIds = marker.fragmentIds.filter((id) => eligibleIds.has(id)).slice(0, MAX_FRAGMENTS_PER_STORY)

  notify('TitleGenerator')
  const titleSuggested = await generateStoryTitle({
    plan: planV1,
    seed,
    ...cwdArg,
    ...storyIdArg,
  })

  return {
    planV1,
    planFinal: planV1,
    planIterationsCount: 1,
    titleSuggested,
    plotCriticOutput: { issues: [], improvement_needed: false } as CriticOutput,
    models,
    promptVersions: resolvedVersions,
    sashaContext: options.sashaContext ?? null,
    usedFragmentIds,
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
  exemplars?: Exemplar[]
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
  const exemplarsArg = options.exemplars && options.exemplars.length > 0
    ? { exemplars: options.exemplars }
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
  const storyIdArg = { storyId: options.storyId }

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
    ...exemplarsArg,
    ...storyIdArg,
  })

  return {
    textV1,
    textV2: textV1,
    writerCriticOutput: { issues: [], improvement_needed: false } as CriticOutput,
    models,
    promptVersions: resolvedVersions,
  }
}

export async function runPlotterOnly(options: {
  seed: string
  storyId: number
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  userFeedback?: string
  universeId?: number | null
  injectFragments?: boolean
  cwd?: string
  onStepChange?: (step: string) => void
}): Promise<PlotterOnlyResult> {
  const { seed, models } = options
  const notify = options.onStepChange ?? (() => undefined)
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const universeArg = options.universeSystemPrompt !== undefined ? { universeSystemPrompt: options.universeSystemPrompt } : {}
  const universeContextArg = options.universeContext !== undefined ? { universeContext: options.universeContext } : {}
  const styleGuideArg = options.styleGuide !== undefined ? { styleGuide: options.styleGuide } : {}
  const sashaContextArg = options.sashaContext !== undefined && options.sashaContext !== null ? { sashaContext: options.sashaContext } : {}
  const userFeedbackArg = options.userFeedback ? { userFeedback: options.userFeedback } : {}

  const plotterPrompt = await resolvePrompt('plotter', PLOTTER_SYSTEM_PROMPT_DEFAULT, options.promptVersions.plotter)

  const resolvedVersions: PipelinePromptVersions = {
    ...options.promptVersions,
    plotter: plotterPrompt.version,
  }

  const storyIdArg = { storyId: options.storyId }

  const eligibleFragments = options.injectFragments
    ? await loadEligibleFragments(options.universeId ?? null)
    : []
  const fragmentsArg = eligibleFragments.length > 0 ? { eligibleFragments } : {}

  notify('Plotter')
  const planRaw = await runPlotter({
    seed,
    model: models.plotter,
    resolvedPrompt: plotterPrompt,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
    ...fragmentsArg,
    ...userFeedbackArg,
    ...storyIdArg,
  })

  const marker = extractFragmentMarkers(planRaw)
  const planV1 = marker.cleanedText
  const eligibleIds = new Set(eligibleFragments.map((f) => f.id))
  const usedFragmentIds = marker.fragmentIds.filter((id) => eligibleIds.has(id)).slice(0, MAX_FRAGMENTS_PER_STORY)

  notify('TitleGenerator')
  const titleSuggested = await generateStoryTitle({
    plan: planV1,
    seed,
    ...cwdArg,
    ...storyIdArg,
  })

  return {
    planV1,
    titleSuggested,
    models,
    promptVersions: resolvedVersions,
    sashaContext: options.sashaContext ?? null,
    usedFragmentIds,
  }
}

export async function runWriterOnly(options: {
  seed: string
  planFinal: string
  storyId: number
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  exemplars?: Exemplar[]
  chosenFragments?: string[]
  previousText?: string
  userAnnotations?: string
  cwd?: string
  onStepChange?: (step: string) => void
  onChunk?: (chunk: string) => void
  onChunkReset?: () => void
}): Promise<WriterOnlyResult> {
  const { seed, planFinal, models } = options
  const notify = options.onStepChange ?? (() => undefined)
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const universeArg = options.universeSystemPrompt !== undefined ? { universeSystemPrompt: options.universeSystemPrompt } : {}
  const universeContextArg = options.universeContext !== undefined ? { universeContext: options.universeContext } : {}
  const styleGuideArg = options.styleGuide !== undefined ? { styleGuide: options.styleGuide } : {}
  const sashaContextArg = options.sashaContext !== undefined && options.sashaContext !== null ? { sashaContext: options.sashaContext } : {}
  const exemplarsArg = options.exemplars && options.exemplars.length > 0 ? { exemplars: options.exemplars } : {}
  const chosenFragmentsArg = options.chosenFragments && options.chosenFragments.length > 0 ? { chosenFragments: options.chosenFragments } : {}
  const previousTextArg = options.previousText !== undefined ? { previousText: options.previousText } : {}
  const userAnnotationsArg = options.userAnnotations ? { userAnnotations: options.userAnnotations } : {}
  const onChunkArg = options.onChunk !== undefined ? { onChunk: options.onChunk } : {}
  const onChunkResetArg = options.onChunkReset !== undefined ? { onChunkReset: options.onChunkReset } : {}

  const writerPrompt: ResolvedPrompt = await resolvePrompt('writer', WRITER_SYSTEM_PROMPT_DEFAULT, options.promptVersions.writer)

  const resolvedVersions: PipelinePromptVersions = {
    ...options.promptVersions,
    writer: writerPrompt.version,
  }

  const storyIdArg = { storyId: options.storyId }

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
    ...exemplarsArg,
    ...chosenFragmentsArg,
    ...previousTextArg,
    ...userAnnotationsArg,
    ...onChunkArg,
    ...onChunkResetArg,
    ...storyIdArg,
  })

  return { textV1, models, promptVersions: resolvedVersions }
}

export async function runTextCritique(options: {
  textV1: string
  planFinal: string
  storyId: number
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  userAnnotations?: string
  cwd?: string
  onStepChange?: (step: string) => void
  onChunk?: (chunk: string) => void
  onChunkReset?: () => void
}): Promise<TextCritiqueResult> {
  const { textV1, planFinal, models } = options
  const notify = options.onStepChange ?? (() => undefined)
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const universeArg = options.universeSystemPrompt !== undefined ? { universeSystemPrompt: options.universeSystemPrompt } : {}
  const universeContextArg = options.universeContext !== undefined ? { universeContext: options.universeContext } : {}
  const styleGuideArg = options.styleGuide !== undefined ? { styleGuide: options.styleGuide } : {}
  const sashaContextArg = options.sashaContext !== undefined && options.sashaContext !== null ? { sashaContext: options.sashaContext } : {}
  const userAnnotationsArg = options.userAnnotations ? { userAnnotations: options.userAnnotations } : {}
  const onChunkArg = options.onChunk !== undefined ? { onChunk: options.onChunk } : {}
  const onChunkResetArg = options.onChunkReset !== undefined ? { onChunkReset: options.onChunkReset } : {}

  const writerPrompt: ResolvedPrompt = await resolvePrompt('writer', WRITER_SYSTEM_PROMPT_DEFAULT, options.promptVersions.writer)

  const resolvedVersions: PipelinePromptVersions = {
    ...options.promptVersions,
    writer: writerPrompt.version,
  }

  const storyIdArg = { storyId: options.storyId }

  notify('Writer')
  const textV2 = await runWriter({
    plan: planFinal,
    previousText: textV1,
    model: models.writer,
    resolvedPrompt: writerPrompt,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
    ...userAnnotationsArg,
    ...onChunkArg,
    ...onChunkResetArg,
    ...storyIdArg,
  })

  const writerCriticOutput: CriticOutput = { issues: [], improvement_needed: false }

  return { textV2, writerCriticOutput, models, promptVersions: resolvedVersions }
}

export async function runAnnotatedRewrite(options: {
  currentText: string
  planFinal: string
  storyId: number
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  userAnnotations?: string
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  cwd?: string
  onStepChange?: (step: string) => void
  onChunk?: (chunk: string) => void
  onChunkReset?: () => void
}): Promise<AnnotatedRewriteResult> {
  const { planFinal, models } = options
  const notify = options.onStepChange ?? (() => undefined)
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const universeArg = options.universeSystemPrompt !== undefined ? { universeSystemPrompt: options.universeSystemPrompt } : {}
  const universeContextArg = options.universeContext !== undefined ? { universeContext: options.universeContext } : {}
  const styleGuideArg = options.styleGuide !== undefined ? { styleGuide: options.styleGuide } : {}
  const sashaContextArg = options.sashaContext !== undefined && options.sashaContext !== null ? { sashaContext: options.sashaContext } : {}
  const onChunkArg = options.onChunk !== undefined ? { onChunk: options.onChunk } : {}
  const onChunkResetArg = options.onChunkReset !== undefined ? { onChunkReset: options.onChunkReset } : {}

  const writerPrompt: ResolvedPrompt = await resolvePrompt('writer', WRITER_SYSTEM_PROMPT_DEFAULT, options.promptVersions.writer)

  const resolvedVersions: PipelinePromptVersions = {
    ...options.promptVersions,
    writer: writerPrompt.version,
  }

  notify('Writer')

  const storyIdArg = { storyId: options.storyId }

  const textV2 = await runWriter({
    plan: planFinal,
    previousText: options.currentText,
    ...(options.userAnnotations ? { userAnnotations: options.userAnnotations } : {}),
    model: models.writer,
    resolvedPrompt: writerPrompt,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
    ...onChunkArg,
    ...onChunkResetArg,
    ...storyIdArg,
  })

  return { textV2, models, promptVersions: resolvedVersions }
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
  return withPipelineTraceIfNone(String(options.storyId), async () => {
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
      model: models.plotterQuestions,
      storyId: options.storyId,
      ...cwdArg,
      ...universeArg,
      ...universeContextArg,
      ...sashaContextArg,
    })
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
  return withPipelineTrace(String(options.storyId), async (_trace) => {
    addStoryContext({ storyId: String(options.storyId) })

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
  })
}
