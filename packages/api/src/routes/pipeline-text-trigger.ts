import { eq, desc, and, isNull, or } from 'drizzle-orm'
import { runWriterOnly } from '@bedtime/core/pipeline/orchestrator'
import { validateWriterOutput } from '@bedtime/core/pipeline/validate-writer-output'
import { loadRandomExemplars } from '@bedtime/core/pipeline/load-exemplars'
import { loadStoryFragmentTexts } from '@bedtime/core/pipeline/load-fragments'
import { loadEligibleWords, recordStoryWords } from '@bedtime/core/pipeline/load-words'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories, annotations } from '@bedtime/core/db/schema'
import {
  buildWriterOnlyStoriesUpdate,
  insertTextVersion,
} from './pipeline-persistence'
import { getPipelineStatus, setPipelineStatus, setCurrentStep, emitPipelineEvent } from './pipeline-state'
import { defaultPromptVersions, resolvePipelineModels, loadStoryOverrides } from './pipeline-defaults'
import { notifyStoryReady, notifyStoryFailed } from './pipeline-notifications'
import { withPipelineTraceIfNone } from '@bedtime/observability'

export { getPipelineStatus, setPipelineStatus }

export interface TextPhaseParams {
  storyId: number
  seed: string
  planFinal: string
  mode: 'auto' | 'manual'
  universeSystemPrompt?: string | undefined
  sashaContext?: string | null | undefined
  universeContext?: string | undefined
  styleGuide?: string | undefined
  universeIds?: number[] | undefined
  currentText?: string | undefined
  activeTextVersionId?: number | null | undefined
}

export async function runTextPhaseDurable(params: TextPhaseParams): Promise<void> {
  const {
    storyId,
    seed,
    planFinal,
    mode,
    universeSystemPrompt,
    sashaContext,
    universeContext,
    styleGuide,
    universeIds = [],
    currentText,
    activeTextVersionId,
  } = params
  const primaryUniverseId = universeIds[0] ?? null

  setPipelineStatus(storyId, 'text_running')

  try {
    await withPipelineTraceIfNone(String(storyId), async () => {
    const isRetry = currentText !== undefined && currentText.length > 0

    const annotationContext = isRetry ? 'text' : 'plan'

    const versionFilter = isRetry
      ? activeTextVersionId
        ? or(eq(annotations.textVersionId, activeTextVersionId), isNull(annotations.textVersionId))
        : isNull(annotations.textVersionId)
      : undefined

    const [rows, resolvedModels, exemplars] = await Promise.all([
      db
        .select({ selectedText: annotations.selectedText, noteText: annotations.noteText })
        .from(annotations)
        .where(and(eq(annotations.storyId, storyId), eq(annotations.context, annotationContext), versionFilter)),
      loadStoryOverrides(storyId).then((overrides) => resolvePipelineModels(primaryUniverseId, overrides)),
      isRetry ? Promise.resolve([]) : loadRandomExemplars(universeIds, 2),
    ])
    const { models, fallbacks } = resolvedModels

    const userAnnotations = rows
      .filter((a) => a.noteText)
      .map((a) => `К фрагменту «${a.selectedText}»:\n${a.noteText}`)
      .join('\n\n')

    if (exemplars.length > 0) {
      console.log(`[WRITER] using ${exemplars.length} canonical exemplar(s): ${exemplars.map((e) => `«${e.title || 'untitled'}»`).join(', ')}`)
    }

    const [chosenFragments, targetWords] = await Promise.all([
      isRetry ? Promise.resolve([]) : loadStoryFragmentTexts(storyId),
      isRetry ? Promise.resolve([]) : loadEligibleWords(universeIds),
    ])

    if (chosenFragments.length > 0) {
      console.log(`[WRITER] weaving in ${chosenFragments.length} fragment(s)`)
    }

    if (targetWords.length > 0) {
      console.log(`[WRITER] offering ${targetWords.length} target word(s)`)
    }

    const result = await runWriterOnly({
      seed,
      planFinal,
      storyId,
      models,
      fallbacks,
      promptVersions: defaultPromptVersions,
      ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
      ...(universeContext !== undefined ? { universeContext } : {}),
      ...(styleGuide !== undefined ? { styleGuide } : {}),
      ...(sashaContext !== undefined && sashaContext !== null ? { sashaContext } : {}),
      ...(exemplars.length > 0 ? { exemplars } : {}),
      ...(chosenFragments.length > 0 ? { chosenFragments } : {}),
      ...(targetWords.length > 0 ? { targetWords } : {}),
      ...(isRetry ? { previousText: currentText } : {}),
      ...(userAnnotations ? { userAnnotations } : {}),
      universeIds,
      onStepChange: (step) => setCurrentStep(storyId, step),
      onChunk: (chunk) => emitPipelineEvent(storyId, { type: 'chunk', text: chunk }),
      onChunkReset: () => emitPipelineEvent(storyId, { type: 'chunk_reset' }),
    })

    const validation = validateWriterOutput(result.textV1)

    if (!validation.valid) {
      console.error(`[WRITER] story=${storyId} — rejected writer output: ${validation.reason}`)
      throw new Error(`Writer produced invalid output for storyId=${storyId}: ${validation.reason}`)
    }

    try {
      const [existing] = await db
        .select()
        .from(runSnapshots)
        .where(eq(runSnapshots.storyId, storyId))
        .orderBy(desc(runSnapshots.createdAt))
        .limit(1)

      if (existing) {
        await db
          .update(runSnapshots)
          .set({ textV1: result.textV1, writerModel: result.models.writer, writerPromptVersion: result.promptVersions.writer })
          .where(eq(runSnapshots.id, existing.id))
      }

      const versionId = await insertTextVersion(storyId, result.textV1, result.models.writer, 'writer_initial')
      await recordStoryWords(storyId, result.usedWordIds)
      const isAuto = mode === 'auto'

      await db
        .update(stories)
        .set({ ...buildWriterOnlyStoriesUpdate(result), activeTextVersionId: versionId, status: 'proofreading', updatedAt: new Date() })
        .where(eq(stories.id, storyId))

      setPipelineStatus(storyId, isAuto ? 'text_ready' : 'text_review')

      if (isAuto) {
        notifyStoryReady(storyId, 'generated')
      }
    } catch (dbError) {
      console.error(`Failed to persist text phase for storyId=${storyId}:`, dbError)
      throw dbError
    }
    })
  } catch (textError) {
    setPipelineStatus(storyId, 'text_failed')

    if (mode === 'auto') {
      notifyStoryFailed(storyId, 'text')
    }

    throw textError
  }
}

export function triggerTextPhase(
  storyId: number,
  seed: string,
  planFinal: string,
  mode: 'auto' | 'manual',
  universeSystemPrompt?: string,
  sashaContext?: string | null,
  universeContext?: string,
  styleGuide?: string,
  universeIds: number[] = [],
  currentText?: string,
  activeTextVersionId?: number | null,
): void {
  void runTextPhaseDurable({
    storyId,
    seed,
    planFinal,
    mode,
    universeSystemPrompt,
    sashaContext,
    universeContext,
    styleGuide,
    universeIds,
    currentText,
    activeTextVersionId,
  }).catch((textError) => {
    setPipelineStatus(storyId, 'text_failed')
    console.error(`Text phase failed for storyId=${storyId}:`, textError)
  })
}
