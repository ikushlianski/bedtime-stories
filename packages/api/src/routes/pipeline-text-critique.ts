import { eq, and, desc } from 'drizzle-orm'
import { runTextCritique, runAnnotatedRewrite } from '@bedtime/core/pipeline/orchestrator'
import { db } from '@bedtime/core/db/client'
import { annotations, runSnapshots, stories } from '@bedtime/core/db/schema'
import { buildTextCritiqueStoriesUpdate, buildTextCritiqueSnapshotUpdate, buildAnnotatedRewriteStoriesUpdate, buildAnnotatedRewriteSnapshotUpdate } from './pipeline-persistence'
import { setPipelineStatus, setCurrentStep, setStepSummary, emitPipelineEvent } from './pipeline-state'
import { defaultModels, defaultPromptVersions } from './pipeline-defaults'

function shortenDescription(desc: string): string {
  const match = desc.match(/^(.{20,120}[.!?])(?:\s|$)/)
  if (match?.[1]) return match[1]
  return desc.length > 100 ? desc.slice(0, 100) + '…' : desc
}

function formatAnnotationsAsFeedback(items: Array<{ selectedText: string; noteText: string | null }>): string {
  return items
    .filter((a) => a.noteText)
    .map((a, i) => `${i + 1}. On the passage "${a.selectedText}":\n   ${a.noteText}`)
    .join('\n\n')
}

export function triggerTextCritique(
  storyId: number,
  textV1: string,
  planFinal: string,
  universeSystemPrompt?: string,
  universeContext?: string,
  styleGuide?: string,
  sashaContext?: string | null,
): void {
  setPipelineStatus(storyId, 'text_running')

  db.select({ selectedText: annotations.selectedText, noteText: annotations.noteText })
    .from(annotations)
    .where(and(eq(annotations.storyId, storyId), eq(annotations.context, 'text')))
    .then((rows) => {
      const withNotes = rows.filter((r) => r.noteText)

      console.log(`\n[TEXT-CRITIQUE] story=${storyId} — annotations in DB: ${rows.length} total, ${withNotes.length} with notes`)

      if (withNotes.length > 0) {
        withNotes.forEach((r, i) => {
          console.log(`  [${i + 1}] «${r.selectedText}» → ${r.noteText}`)
        })
      } else {
        console.log('  (no annotations with notes — running critic without editor feedback)')
      }

      const userAnnotations = formatAnnotationsAsFeedback(rows)

      if (userAnnotations) {
        console.log(`[TEXT-CRITIQUE] story=${storyId} — passing annotations to WriterCritic:\n${userAnnotations}\n`)
      }

      return runTextCritique({
        textV1,
        planFinal,
        storyId,
        models: defaultModels,
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
    })
    .then(async (result) => {
      const criticIssues = result.writerCriticOutput.issues
      const mustIssues = criticIssues.filter((i) => i.prio === 'must')
      const niceIssues = criticIssues.filter((i) => i.prio === 'nice')

      const suffix = criticIssues.length === 1 ? 'е' : criticIssues.length < 5 ? 'я' : 'й'
      const criticSummary = criticIssues.length === 0
        ? 'Критик не нашёл замечаний.'
        : [
            `Критик обнаружил ${criticIssues.length} замечани${suffix}.`,
            ...mustIssues.map((i) => `Исправить: ${shortenDescription(i.description)}`),
            ...niceIssues.map((i) => `Улучшить: ${shortenDescription(i.description)}`),
          ].join('\n')

      setStepSummary(storyId, 'WriterCritic', criticSummary)

      const writerSummary = mustIssues.length === 0
        ? 'Текст переработан без обязательных замечаний.'
        : [
            `Текст переработан с учётом ${mustIssues.length} обязательных замечаний:`,
            ...mustIssues.map((i) => shortenDescription(i.description)),
          ].join('\n')

      setStepSummary(storyId, 'Writer', writerSummary)

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
            .set(buildTextCritiqueSnapshotUpdate(result))
            .where(eq(runSnapshots.id, existing.id))
        }

        await db.update(stories).set(buildTextCritiqueStoriesUpdate(result)).where(eq(stories.id, storyId))

        setPipelineStatus(storyId, 'text_review')
      } catch (dbError) {
        console.error(`Failed to persist text critique for storyId=${storyId}:`, dbError)
        setPipelineStatus(storyId, 'text_failed')
      }
    })
    .catch((err) => {
      setPipelineStatus(storyId, 'text_failed')
      console.error(`Text critique failed for storyId=${storyId}:`, err)
    })
}

export function triggerTextRewrite(
  storyId: number,
  currentText: string,
  planFinal: string,
  universeSystemPrompt?: string,
  universeContext?: string,
  styleGuide?: string,
  sashaContext?: string | null,
): void {
  setPipelineStatus(storyId, 'text_running')

  db.select({ selectedText: annotations.selectedText, noteText: annotations.noteText })
    .from(annotations)
    .where(and(eq(annotations.storyId, storyId), eq(annotations.context, 'text')))
    .then(async (rows) => {
      const withNotes = rows.filter((r) => r.noteText)

      console.log(`\n[TEXT-REWRITE] story=${storyId} — annotations: ${rows.length} total, ${withNotes.length} with notes`)

      if (withNotes.length > 0) {
        withNotes.forEach((r, i) => {
          console.log(`  [${i + 1}] «${r.selectedText}» → ${r.noteText}`)
        })
      }

      const userAnnotations = formatAnnotationsAsFeedback(rows)

      return runAnnotatedRewrite({
        currentText,
        planFinal,
        storyId,
        models: defaultModels,
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
    })
    .then(async (result) => {
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

        await db.update(stories).set(buildAnnotatedRewriteStoriesUpdate(result)).where(eq(stories.id, storyId))

        await db.delete(annotations).where(and(eq(annotations.storyId, storyId), eq(annotations.context, 'text')))

        console.log(`[TEXT-REWRITE] story=${storyId} — cleared text annotations after successful rewrite`)

        setPipelineStatus(storyId, 'text_review')
      } catch (dbError) {
        console.error(`Failed to persist annotated rewrite for storyId=${storyId}:`, dbError)
        setPipelineStatus(storyId, 'text_failed')
      }
    })
    .catch((err) => {
      setPipelineStatus(storyId, 'text_failed')
      console.error(`Text rewrite failed for storyId=${storyId}:`, err)
    })
}
