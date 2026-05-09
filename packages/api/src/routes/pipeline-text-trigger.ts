import { eq, desc, and, isNull, or } from 'drizzle-orm'
import { runWriterOnly } from '@bedtime/core/pipeline/orchestrator'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories, annotations } from '@bedtime/core/db/schema'
import {
  buildWriterOnlyStoriesUpdate,
  insertTextVersion,
} from './pipeline-persistence'
import { getPipelineStatus, setPipelineStatus, setCurrentStep, emitPipelineEvent } from './pipeline-state'
import { defaultPromptVersions, resolvePipelineModels, loadStoryOverrides } from './pipeline-defaults'
import { withPipelineTraceIfNone } from '@bedtime/observability'
import { notifyStoryReady } from './pipeline-notifications'

export { getPipelineStatus, setPipelineStatus }

export function triggerTextPhase(
  storyId: number,
  seed: string,
  planFinal: string,
  mode: 'auto' | 'manual',
  universeSystemPrompt?: string,
  sashaContext?: string | null,
  universeContext?: string,
  styleGuide?: string,
  universeId: number | null = null,
  currentText?: string,
  activeTextVersionId?: number | null,
): void {
  setPipelineStatus(storyId, 'text_running')

  withPipelineTraceIfNone(String(storyId), async () => {
    const isRetry = currentText !== undefined && currentText.length > 0

    const annotationContext = isRetry ? 'text' : 'plan'

    const versionFilter = isRetry
      ? activeTextVersionId
        ? or(eq(annotations.textVersionId, activeTextVersionId), isNull(annotations.textVersionId))
        : isNull(annotations.textVersionId)
      : undefined

    const [rows, models] = await Promise.all([
      db
        .select({ selectedText: annotations.selectedText, noteText: annotations.noteText })
        .from(annotations)
        .where(and(eq(annotations.storyId, storyId), eq(annotations.context, annotationContext), versionFilter)),
      loadStoryOverrides(storyId).then((overrides) => resolvePipelineModels(universeId, overrides)),
    ])

    const userAnnotations = rows
      .filter((a) => a.noteText)
      .map((a) => `К фрагменту «${a.selectedText}»:\n${a.noteText}`)
      .join('\n\n')

    const result = await runWriterOnly({
      seed,
      planFinal,
      storyId,
      models,
      promptVersions: defaultPromptVersions,
      ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
      ...(universeContext !== undefined ? { universeContext } : {}),
      ...(styleGuide !== undefined ? { styleGuide } : {}),
      ...(sashaContext !== undefined && sashaContext !== null ? { sashaContext } : {}),
      ...(isRetry ? { previousText: currentText } : {}),
      ...(userAnnotations ? { userAnnotations } : {}),
      onStepChange: (step) => setCurrentStep(storyId, step),
      onChunk: (chunk) => emitPipelineEvent(storyId, { type: 'chunk', text: chunk }),
      onChunkReset: () => emitPipelineEvent(storyId, { type: 'chunk_reset' }),
    })

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
      await db.update(stories).set({ ...buildWriterOnlyStoriesUpdate(result), activeTextVersionId: versionId }).where(eq(stories.id, storyId))

      if (mode === 'auto') {
        await db.update(stories).set({ status: 'ready', updatedAt: new Date() }).where(eq(stories.id, storyId))
        setPipelineStatus(storyId, 'text_ready')
        notifyStoryReady(storyId)
      } else {
        setPipelineStatus(storyId, 'text_review')
      }
    } catch (dbError) {
      console.error(`Failed to persist text phase for storyId=${storyId}:`, dbError)
      setPipelineStatus(storyId, 'text_failed')
    }
  }).catch((textError) => {
    setPipelineStatus(storyId, 'text_failed')
    console.error(`Text phase failed for storyId=${storyId}:`, textError)
  })
}
