import { eq, and } from 'drizzle-orm'
import { runPlotterOnly } from '@bedtime/core/pipeline/orchestrator'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer'
import { generatePlanChangeSummary } from '@bedtime/core/pipeline/plan-change-summarizer'
import { db } from '@bedtime/core/db/client'
import { annotations, runSnapshots, stories } from '@bedtime/core/db/schema'
import {
  buildPlotterOnlySnapshotInsert,
  buildPlotterOnlyStoriesUpdate,
} from './pipeline-persistence'
import { setPipelineStatus, setCurrentStep, setStepSummary } from './pipeline-state'
import { defaultModels, defaultPromptVersions } from './pipeline-defaults'

function extractPlotterSummary(planText: string): string {
  const lines = planText.split('\n')
  const taskIdx = lines.findIndex((l) => l.includes('ЭМОЦИОНАЛЬНАЯ ЗАДАЧА'))

  if (taskIdx === -1) return 'Сюжетник пересмотрел план истории.'

  const taskLine = lines.slice(taskIdx + 1).find((l) => l.trim().length > 0)

  if (!taskLine) return 'Сюжетник пересмотрел план истории.'

  return `Сюжетник пересмотрел план. Эмоциональная задача: ${taskLine.trim()}`
}

function formatAnnotationsAsFeedback(items: Array<{ selectedText: string; noteText: string | null }>): string {
  return items
    .filter((a) => a.noteText)
    .map((a, i) => `${i + 1}. On the passage "${a.selectedText}":\n   ${a.noteText}`)
    .join('\n\n')
}

export function triggerPlanRedo(storyId: number, seed: string, previousPlan: string, universeSystemPrompt?: string, universeContext?: string, styleGuide?: string): void {
  setPipelineStatus(storyId, 'plan_running')

  db.select({ selectedText: annotations.selectedText, noteText: annotations.noteText })
    .from(annotations)
    .where(and(eq(annotations.storyId, storyId), eq(annotations.context, 'plan')))
    .then((rows) => {
      const planRows = rows.filter((r): r is { selectedText: string; noteText: string | null } => true)
      const userFeedback = formatAnnotationsAsFeedback(planRows)

      return synthesizeSashaContext().then((sashaContext) =>
        runPlotterOnly({
          seed,
          storyId,
          models: defaultModels,
          promptVersions: defaultPromptVersions,
          ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
          ...(universeContext !== undefined ? { universeContext } : {}),
          ...(styleGuide !== undefined ? { styleGuide } : {}),
          ...(sashaContext !== null ? { sashaContext } : {}),
          ...(userFeedback ? { userFeedback } : {}),
          onStepChange: (step) => setCurrentStep(storyId, step),
        }).then(async (result) => ({ result, userFeedback }))
      )
    })
    .then(async ({ result, userFeedback }) => {
      setStepSummary(storyId, 'Plotter', extractPlotterSummary(result.planV1))

      try {
        const changeSummary = await generatePlanChangeSummary({
          previousPlan,
          newPlan: result.planV1,
          userFeedback,
          model: defaultModels.plotter,
        })

        await db.insert(runSnapshots).values(buildPlotterOnlySnapshotInsert(storyId, result))

        await db
          .update(stories)
          .set({ ...buildPlotterOnlyStoriesUpdate(result), planChangeSummary: changeSummary })
          .where(eq(stories.id, storyId))

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
