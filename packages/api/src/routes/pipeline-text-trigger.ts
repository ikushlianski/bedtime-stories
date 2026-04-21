import { eq, desc, and } from 'drizzle-orm'
import { runWriterOnly } from '@bedtime/core/pipeline/orchestrator'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories, annotations } from '@bedtime/core/db/schema'
import {
  buildWriterOnlyStoriesUpdate,
} from './pipeline-persistence'
import { getPipelineStatus, setPipelineStatus, setCurrentStep, emitPipelineEvent } from './pipeline-state'
import { defaultModels, defaultPromptVersions } from './pipeline-defaults'

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
): void {
  setPipelineStatus(storyId, 'text_running')

  db.select({ selectedText: annotations.selectedText, noteText: annotations.noteText })
    .from(annotations)
    .where(and(eq(annotations.storyId, storyId), eq(annotations.context, 'plan')))
    .then((rows) => {
      const planAnnotations = rows
        .filter((a) => a.noteText)
        .map((a) => `К фрагменту «${a.selectedText}»:\n${a.noteText}`)
        .join('\n\n')

      return runWriterOnly({
        seed,
        planFinal,
        storyId,
        models: defaultModels,
        promptVersions: defaultPromptVersions,
        ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
        ...(universeContext !== undefined ? { universeContext } : {}),
        ...(styleGuide !== undefined ? { styleGuide } : {}),
        ...(sashaContext !== undefined && sashaContext !== null ? { sashaContext } : {}),
        ...(planAnnotations ? { userAnnotations: planAnnotations } : {}),
        onStepChange: (step) => setCurrentStep(storyId, step),
        onChunk: (chunk) => emitPipelineEvent(storyId, { type: 'chunk', text: chunk }),
        onChunkReset: () => emitPipelineEvent(storyId, { type: 'chunk_reset' }),
      })
    })
    .then(async (result) => {
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

        await db.update(stories).set(buildWriterOnlyStoriesUpdate(result)).where(eq(stories.id, storyId))

        if (mode === 'auto') {
          await db.update(stories).set({ status: 'ready', updatedAt: new Date() }).where(eq(stories.id, storyId))
          setPipelineStatus(storyId, 'text_ready')
        } else {
          setPipelineStatus(storyId, 'text_review')
        }
      } catch (dbError) {
        console.error(`Failed to persist text phase for storyId=${storyId}:`, dbError)
        setPipelineStatus(storyId, 'text_failed')
      }
    })
    .catch((textError) => {
      setPipelineStatus(storyId, 'text_failed')
      console.error(`Text phase failed for storyId=${storyId}:`, textError)
    })
}
