import { eq, and, isNull, or, desc } from 'drizzle-orm'
import { runAnnotatedRewrite } from '@bedtime/core/pipeline/orchestrator'
import { db } from '@bedtime/core/db/client'
import { annotations, runSnapshots, stories } from '@bedtime/core/db/schema'
import { buildAnnotatedRewriteStoriesUpdate, buildAnnotatedRewriteSnapshotUpdate, insertTextVersion } from './pipeline-persistence'
import { setPipelineStatus, setCurrentStep, setStepSummary, emitPipelineEvent } from './pipeline-state'
import { defaultPromptVersions, resolvePipelineModels, loadStoryOverrides } from './pipeline-defaults'
import { gatherRedoFeedback } from './gather-redo-feedback'
import { withPipelineTraceIfNone } from '@bedtime/observability'

export function triggerTextRewrite(
  storyId: number,
  currentText: string,
  planFinal: string,
  universeSystemPrompt?: string,
  universeContext?: string,
  styleGuide?: string,
  sashaContext?: string | null,
  universeId: number | null = null,
  activeTextVersionId?: number | null,
  reason?: string,
  modelOverride?: string,
): void {
  setPipelineStatus(storyId, 'text_running')

  withPipelineTraceIfNone(String(storyId), async () => {
    const [feedback, models] = await Promise.all([
      gatherRedoFeedback({ storyId, context: 'text', reason, universeId, activeTextVersionId }),
      loadStoryOverrides(storyId).then((overrides) => resolvePipelineModels(universeId, overrides)),
    ])

    if (modelOverride) {
      models.writer = modelOverride
    }

    const userAnnotations = feedback.userFeedback
    const withNotes = feedback.annotationRows.filter((r) => r.noteText)

    console.log(`\n[TEXT-REWRITE] story=${storyId} — annotations: ${feedback.annotationRows.length} total, ${withNotes.length} with notes, reason: ${reason?.trim() ? 'yes' : 'no'}`)

    if (withNotes.length > 0) {
      withNotes.forEach((r, i) => {
        console.log(`  [${i + 1}] ${r.selectedText ? `«${r.selectedText}»` : '(общий комментарий)'} → ${r.noteText}`)
      })
    }

    const result = await runAnnotatedRewrite({
      currentText,
      planFinal,
      storyId,
      models,
      promptVersions: defaultPromptVersions,
      ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
      ...(universeContext !== undefined ? { universeContext } : {}),
      ...(styleGuide !== undefined ? { styleGuide } : {}),
      ...(sashaContext !== undefined && sashaContext !== null ? { sashaContext } : {}),
      ...(userAnnotations ? { userAnnotations } : {}),
      onStepChange: (step) => setCurrentStep(storyId, step),
      onChunk: (chunk) => emitPipelineEvent(storyId, { type: 'chunk', text: chunk }),
      onChunkReset: () => emitPipelineEvent(storyId, { type: 'chunk_reset' }),
    })

    setStepSummary(storyId, 'WriterCritic', 'Пропущен — применены заметки редактора напрямую')
    setStepSummary(storyId, 'Writer', 'Текст переработан с учётом заметок редактора.')

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
          .set(buildAnnotatedRewriteSnapshotUpdate(result))
          .where(eq(runSnapshots.id, existing.id))
      }

      const rewriteVersionId = await insertTextVersion(storyId, result.textV2, result.models.writer, 'annotated_rewrite')
      await db.update(stories).set({ ...buildAnnotatedRewriteStoriesUpdate(result), activeTextVersionId: rewriteVersionId }).where(eq(stories.id, storyId))

      const deleteFilter = activeTextVersionId
        ? and(eq(annotations.storyId, storyId), eq(annotations.context, 'text'), or(eq(annotations.textVersionId, activeTextVersionId), isNull(annotations.textVersionId)))
        : and(eq(annotations.storyId, storyId), eq(annotations.context, 'text'))

      await db.delete(annotations).where(deleteFilter)

      console.log(`[TEXT-REWRITE] story=${storyId} — cleared text annotations after successful rewrite`)

      setPipelineStatus(storyId, 'text_review')
    } catch (dbError) {
      console.error(`Failed to persist annotated rewrite for storyId=${storyId}:`, dbError)
      setPipelineStatus(storyId, 'text_failed')
    }
  }).catch((err) => {
    setPipelineStatus(storyId, 'text_failed')
    console.error(`Text rewrite failed for storyId=${storyId}:`, err)
  })
}
