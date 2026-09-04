import { runPlotter, PLOTTER_SYSTEM_PROMPT_DEFAULT } from './stages/plotter'
import { runWriter, WRITER_SYSTEM_PROMPT_DEFAULT } from './stages/writer'
import { runPlotterQuestions, type PlotterQuestionItem } from './stages/plotter-questions'
import { generateStoryTitle } from './stages/title-generator'
import { resolvePrompt, type ResolvedPrompt } from './prompt-resolver'
import { loadEligibleFragments, extractFragmentMarkers, MAX_FRAGMENTS_PER_STORY, type ChosenFragment } from './load-fragments'
import { loadEligibleTopics, loadTopicsByIds, extractTopicMarkers, MAX_TOPICS_PER_STORY } from './load-topics'
import { loadReactionPreferences, MIN_REACTIONS } from './load-reaction-preferences'
import { loadMemorableMoments } from './load-memorable-moments'
import { loadReferenceStory } from './load-reference-story'
import { loadRecentTitles } from './load-recent-titles'
import { resolveStoryStructureChoice } from './resolve-story-structure-choice'
import { extractWordMarkers, MAX_WORDS_PER_STORY, type TargetWord } from './stages/words-block'
import { extractCharacterMarkers, type CharacterBibleEntry } from './stages/character-bible-block'
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

export interface PipelineModelFallbacks {
  plotter?: string
  plotCritic?: string
  writer?: string
  writerCritic?: string
  plotterQuestions?: string
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
  usedTopicIds: number[]
  usedCharacterIds: number[]
}

export interface PlotterOnlyResult {
  planV1: string
  titleSuggested: string
  models: PipelineModels
  promptVersions: PipelinePromptVersions
  sashaContext: string | null
  usedFragmentIds: number[]
  usedTopicIds: number[]
  usedCharacterIds: number[]
}

export interface WriterOnlyResult {
  textV1: string
  usedWordIds: number[]
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
  fallbacks?: PipelineModelFallbacks
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  userFeedback?: string
  universeIds?: number[]
  injectFragments?: boolean
  injectTopics?: boolean
  manualTopicIds?: number[]
  bibleCharacters?: CharacterBibleEntry[]
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
  const universeIds = options.universeIds ?? []
  const manualTopicIds = options.manualTopicIds ?? []

  const [eligibleFragments, eligibleTopics, reactionSummary, memorableMoments, structureChoice, recentTitles, referenceStory] = await Promise.all([
    options.injectFragments ? loadEligibleFragments(universeIds) : Promise.resolve([]),
    manualTopicIds.length > 0
      ? loadTopicsByIds(manualTopicIds)
      : (options.injectTopics ? loadEligibleTopics(universeIds, options.storyId) : Promise.resolve([])),
    loadReactionPreferences(universeIds),
    loadMemorableMoments(universeIds, options.storyId),
    resolveStoryStructureChoice(options.storyId),
    loadRecentTitles(universeIds[0] ?? null, options.storyId),
    loadReferenceStory(options.storyId),
  ])
  const fragmentsArg = eligibleFragments.length > 0 ? { eligibleFragments } : {}
  const topicsArg = eligibleTopics.length > 0 ? { eligibleTopics, topicsMode: manualTopicIds.length > 0 ? 'manual' as const : 'auto' as const } : {}
  const reactionArg = reactionSummary && reactionSummary.sampleSize >= MIN_REACTIONS ? { reactionSummary } : {}
  const bibleArg = options.bibleCharacters && options.bibleCharacters.length > 0 ? { bibleCharacters: options.bibleCharacters } : {}
  const memorableMomentsArg = memorableMoments.length > 0 ? { memorableMoments } : {}
  const referenceStoryArg = referenceStory ? { referenceStory } : {}

  const plotterFallbackArg = options.fallbacks?.plotter !== undefined ? { fallback: options.fallbacks.plotter } : {}

  notify('Plotter')
  const planRaw = await runPlotter({
    seed,
    model: models.plotter,
    resolvedPrompt: plotterPrompt,
    structure: structureChoice.structure,
    characterLens: structureChoice.lens,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
    ...fragmentsArg,
    ...topicsArg,
    ...reactionArg,
    ...bibleArg,
    ...memorableMomentsArg,
    ...referenceStoryArg,
    ...userFeedbackArg,
    ...storyIdArg,
    ...plotterFallbackArg,
    universeId: universeIds[0] ?? null,
  })

  const fragmentMarker = extractFragmentMarkers(planRaw)
  const topicMarker = extractTopicMarkers(fragmentMarker.cleanedText)
  const characterMarker = extractCharacterMarkers(topicMarker.cleanedText)
  const planV1 = characterMarker.cleanedText
  const eligibleFragmentIds = new Set(eligibleFragments.map((f) => f.id))
  const usedFragmentIds = fragmentMarker.fragmentIds.filter((id) => eligibleFragmentIds.has(id)).slice(0, MAX_FRAGMENTS_PER_STORY)
  const eligibleTopicIds = new Set(eligibleTopics.map((t) => t.id))
  const usedTopicIds = manualTopicIds.length > 0
    ? eligibleTopics.map((t) => t.id)
    : topicMarker.topicIds.filter((id) => eligibleTopicIds.has(id)).slice(0, MAX_TOPICS_PER_STORY)
  const eligibleCharacterIds = new Set((options.bibleCharacters ?? []).map((c) => c.id).filter((id): id is number => id != null))
  const usedCharacterIds = characterMarker.characterIds.filter((id) => eligibleCharacterIds.has(id))

  notify('TitleGenerator')
  const titleSuggested = await generateStoryTitle({
    plan: planV1,
    seed,
    recentTitles,
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
    usedTopicIds,
    usedCharacterIds,
  }
}

export async function runTextPhase(options: {
  seed: string
  planFinal: string
  storyId: number
  models: PipelineModels
  fallbacks?: PipelineModelFallbacks
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  exemplars?: Exemplar[]
  universeIds?: number[]
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

  const [memorableMoments, structureChoice, referenceStory] = await Promise.all([
    loadMemorableMoments(options.universeIds ?? [], options.storyId),
    resolveStoryStructureChoice(options.storyId),
    loadReferenceStory(options.storyId),
  ])
  const memorableMomentsArg = memorableMoments.length > 0 ? { memorableMoments } : {}
  const referenceStoryArg = referenceStory ? { referenceStory } : {}

  const writerFallbackArg = options.fallbacks?.writer !== undefined ? { fallback: options.fallbacks.writer } : {}

  notify('Writer')
  const textV1 = await runWriter({
    plan: planFinal,
    model: models.writer,
    resolvedPrompt: writerPrompt,
    structure: structureChoice.structure,
    characterLens: structureChoice.lens,
    voice: structureChoice.voice,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
    ...exemplarsArg,
    ...memorableMomentsArg,
    ...referenceStoryArg,
    ...storyIdArg,
    ...writerFallbackArg,
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
  fallbacks?: PipelineModelFallbacks
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  userFeedback?: string
  universeIds?: number[]
  injectFragments?: boolean
  injectTopics?: boolean
  manualTopicIds?: number[]
  bibleCharacters?: CharacterBibleEntry[]
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
  const universeIds = options.universeIds ?? []
  const manualTopicIds = options.manualTopicIds ?? []

  const [eligibleFragments, eligibleTopics, reactionSummary, memorableMoments, structureChoice, recentTitles, referenceStory] = await Promise.all([
    options.injectFragments ? loadEligibleFragments(universeIds) : Promise.resolve([]),
    manualTopicIds.length > 0
      ? loadTopicsByIds(manualTopicIds)
      : (options.injectTopics ? loadEligibleTopics(universeIds, options.storyId) : Promise.resolve([])),
    loadReactionPreferences(universeIds),
    loadMemorableMoments(universeIds, options.storyId),
    resolveStoryStructureChoice(options.storyId),
    loadRecentTitles(universeIds[0] ?? null, options.storyId),
    loadReferenceStory(options.storyId),
  ])
  const fragmentsArg = eligibleFragments.length > 0 ? { eligibleFragments } : {}
  const topicsArg = eligibleTopics.length > 0 ? { eligibleTopics, topicsMode: manualTopicIds.length > 0 ? 'manual' as const : 'auto' as const } : {}
  const reactionArg = reactionSummary && reactionSummary.sampleSize >= MIN_REACTIONS ? { reactionSummary } : {}
  const bibleArg = options.bibleCharacters && options.bibleCharacters.length > 0 ? { bibleCharacters: options.bibleCharacters } : {}
  const memorableMomentsArg = memorableMoments.length > 0 ? { memorableMoments } : {}
  const referenceStoryArg = referenceStory ? { referenceStory } : {}

  const plotterFallbackArg = options.fallbacks?.plotter !== undefined ? { fallback: options.fallbacks.plotter } : {}

  notify('Plotter')
  const planRaw = await runPlotter({
    seed,
    model: models.plotter,
    resolvedPrompt: plotterPrompt,
    structure: structureChoice.structure,
    characterLens: structureChoice.lens,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
    ...fragmentsArg,
    ...topicsArg,
    ...reactionArg,
    ...bibleArg,
    ...memorableMomentsArg,
    ...referenceStoryArg,
    ...userFeedbackArg,
    ...storyIdArg,
    ...plotterFallbackArg,
    universeId: universeIds[0] ?? null,
  })

  const fragmentMarker = extractFragmentMarkers(planRaw)
  const topicMarker = extractTopicMarkers(fragmentMarker.cleanedText)
  const characterMarker = extractCharacterMarkers(topicMarker.cleanedText)
  const planV1 = characterMarker.cleanedText
  const eligibleFragmentIds = new Set(eligibleFragments.map((f) => f.id))
  const usedFragmentIds = fragmentMarker.fragmentIds.filter((id) => eligibleFragmentIds.has(id)).slice(0, MAX_FRAGMENTS_PER_STORY)
  const eligibleTopicIds = new Set(eligibleTopics.map((t) => t.id))
  const usedTopicIds = manualTopicIds.length > 0
    ? eligibleTopics.map((t) => t.id)
    : topicMarker.topicIds.filter((id) => eligibleTopicIds.has(id)).slice(0, MAX_TOPICS_PER_STORY)
  const eligibleCharacterIds = new Set((options.bibleCharacters ?? []).map((c) => c.id).filter((id): id is number => id != null))
  const usedCharacterIds = characterMarker.characterIds.filter((id) => eligibleCharacterIds.has(id))

  notify('TitleGenerator')
  const titleSuggested = await generateStoryTitle({
    plan: planV1,
    seed,
    recentTitles,
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
    usedTopicIds,
    usedCharacterIds,
  }
}

export async function runWriterOnly(options: {
  seed: string
  planFinal: string
  storyId: number
  models: PipelineModels
  fallbacks?: PipelineModelFallbacks
  promptVersions: PipelinePromptVersions
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  exemplars?: Exemplar[]
  chosenFragments?: ChosenFragment[]
  targetWords?: TargetWord[]
  previousText?: string
  userAnnotations?: string
  universeIds?: number[]
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
  const targetWordsArg = options.targetWords && options.targetWords.length > 0 ? { targetWords: options.targetWords } : {}
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

  const [memorableMoments, structureChoice, referenceStory] = await Promise.all([
    loadMemorableMoments(options.universeIds ?? [], options.storyId),
    resolveStoryStructureChoice(options.storyId),
    loadReferenceStory(options.storyId),
  ])
  const memorableMomentsArg = memorableMoments.length > 0 ? { memorableMoments } : {}
  const referenceStoryArg = referenceStory ? { referenceStory } : {}

  const writerFallbackArg = options.fallbacks?.writer !== undefined ? { fallback: options.fallbacks.writer } : {}

  notify('Writer')
  const textV1 = await runWriter({
    plan: planFinal,
    model: models.writer,
    resolvedPrompt: writerPrompt,
    structure: structureChoice.structure,
    characterLens: structureChoice.lens,
    voice: structureChoice.voice,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
    ...exemplarsArg,
    ...chosenFragmentsArg,
    ...targetWordsArg,
    ...previousTextArg,
    ...userAnnotationsArg,
    ...memorableMomentsArg,
    ...referenceStoryArg,
    ...onChunkArg,
    ...onChunkResetArg,
    ...storyIdArg,
    ...writerFallbackArg,
  })

  const wordMarker = extractWordMarkers(textV1, options.targetWords ?? [])
  const eligibleWordIds = new Set((options.targetWords ?? []).map((w) => w.id))
  const usedWordIds = wordMarker.wordIds.filter((id) => eligibleWordIds.has(id)).slice(0, MAX_WORDS_PER_STORY)

  return { textV1: wordMarker.cleanedText, usedWordIds, models, promptVersions: resolvedVersions }
}

export async function runAnnotatedRewrite(options: {
  currentText: string
  planFinal: string
  storyId: number
  models: PipelineModels
  fallbacks?: PipelineModelFallbacks
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
  const writerFallbackArg = options.fallbacks?.writer !== undefined ? { fallback: options.fallbacks.writer } : {}

  const [structureChoice, referenceStory] = await Promise.all([
    resolveStoryStructureChoice(options.storyId),
    loadReferenceStory(options.storyId),
  ])
  const referenceStoryArg = referenceStory ? { referenceStory } : {}

  const textV2 = await runWriter({
    plan: planFinal,
    previousText: options.currentText,
    ...(options.userAnnotations ? { userAnnotations: options.userAnnotations } : {}),
    model: models.writer,
    resolvedPrompt: writerPrompt,
    structure: structureChoice.structure,
    characterLens: structureChoice.lens,
    voice: structureChoice.voice,
    ...cwdArg,
    ...universeArg,
    ...universeContextArg,
    ...styleGuideArg,
    ...sashaContextArg,
    ...referenceStoryArg,
    ...onChunkArg,
    ...onChunkResetArg,
    ...storyIdArg,
    ...writerFallbackArg,
  })

  return { textV2, models, promptVersions: resolvedVersions }
}

export async function runQuestionsPhase(options: {
  seed: string
  storyId: number
  models: PipelineModels
  fallbacks?: PipelineModelFallbacks
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
    const plotterQuestionsFallbackArg = options.fallbacks?.plotterQuestions !== undefined
      ? { fallback: options.fallbacks.plotterQuestions }
      : {}

    return runPlotterQuestions({
      seed,
      model: models.plotterQuestions,
      storyId: options.storyId,
      ...cwdArg,
      ...universeArg,
      ...universeContextArg,
      ...sashaContextArg,
      ...plotterQuestionsFallbackArg,
    })
  })
}

export async function runPipeline(options: {
  seed: string
  storyId: number
  models: PipelineModels
  fallbacks?: PipelineModelFallbacks
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
      ...(options.fallbacks !== undefined ? { fallbacks: options.fallbacks } : {}),
      ...(options.universeSystemPrompt !== undefined ? { universeSystemPrompt: options.universeSystemPrompt } : {}),
      ...(options.universeContext !== undefined ? { universeContext: options.universeContext } : {}),
      ...(options.styleGuide !== undefined ? { styleGuide: options.styleGuide } : {}),
      ...(options.sashaContext !== undefined ? { sashaContext: options.sashaContext } : {}),
      ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    })

    return { ...planPhase, ...textPhase }
  })
}
