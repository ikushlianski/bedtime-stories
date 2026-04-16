import { eq } from 'drizzle-orm'
import { runPlanPhase } from '@bedtime/core/pipeline/orchestrator'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer'
import { db } from '@bedtime/core/db/client'
import { annotations, runSnapshots, stories } from '@bedtime/core/db/schema'
import { buildPlanSnapshotInsert, buildPlanStoriesUpdate } from './pipeline-persistence'
import { setPipelineStatus, setCurrentStep } from './pipeline-state'
import { defaultModels, defaultPromptVersions } from './pipeline-defaults'

function formatAnnotationsAsFeedback(items: Array<{ selectedText: string; noteText: string | null }>): string {
  return items
    .filter((a) => a.noteText)
    .map((a, i) => `${i + 1}. On the passage "${a.selectedText}":\n   ${a.noteText}`)
    .join('\n\n')
}

export function triggerPlanRedo(storyId: number, seed: string, universeSystemPrompt?: string): void {
  setPipelineStatus(storyId, 'plan_running')

  db.select({ selectedText: annotations.selectedText, noteText: annotations.noteText })
    .from(annotations)
    .where(eq(annotations.storyId, storyId))
    .then((rows) => {
      const planRows = rows.filter((r): r is { selectedText: string; noteText: string | null } => true)
      const userFeedback = formatAnnotationsAsFeedback(planRows)

      return synthesizeSashaContext().then((sashaContext) =>
        runPlanPhase({
          seed,
          storyId,
          models: defaultModels,
          promptVersions: defaultPromptVersions,
          ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
          ...(sashaContext !== null ? { sashaContext } : {}),
          ...(userFeedback ? { userFeedback } : {}),
          onStepChange: (step) => setCurrentStep(storyId, step),
        })
      )
    })
    .then(async (plan) => {
      try {
        await db.insert(runSnapshots).values(buildPlanSnapshotInsert(storyId, plan))
        await db.update(stories).set(buildPlanStoriesUpdate(plan)).where(eq(stories.id, storyId))
        setPipelineStatus(storyId, 'plan_ready')
      } catch (dbError) {
        console.error(`Failed to persist plan redo for storyId=${storyId}:`, dbError)
        setPipelineStatus(storyId, 'plan_failed')
      }
    })
    .catch((err) => {
      setPipelineStatus(storyId, 'plan_failed')
      console.error(`Plan redo failed for storyId=${storyId}:`, err)
    })
}
