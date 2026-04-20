import { eq, and, desc } from 'drizzle-orm'
import { runTextCritique } from '@bedtime/core/pipeline/orchestrator'
import { db } from '@bedtime/core/db/client'
import { annotations, runSnapshots, stories } from '@bedtime/core/db/schema'
import { buildTextCritiqueStoriesUpdate, buildTextCritiqueSnapshotUpdate } from './pipeline-persistence'
import { setPipelineStatus, setCurrentStep } from './pipeline-state'
import { defaultModels, defaultPromptVersions } from './pipeline-defaults'

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
      const userAnnotations = formatAnnotationsAsFeedback(rows)

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
