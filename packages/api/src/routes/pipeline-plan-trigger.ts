import { eq } from 'drizzle-orm'
import { runPlotterOnly } from '@bedtime/core/pipeline/orchestrator'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories } from '@bedtime/core/db/schema'
import {
  buildPlotterOnlyStoriesUpdate,
  buildPlotterOnlySnapshotInsert,
} from './pipeline-persistence'
import { setPipelineStatus, setCurrentStep, setStepSummary } from './pipeline-state'
import { defaultModels, defaultPromptVersions } from './pipeline-defaults'

function extractPlotterSummary(planText: string): string {
  const lines = planText.split('\n')
  const taskIdx = lines.findIndex((l) => l.includes('ЭМОЦИОНАЛЬНАЯ ЗАДАЧА'))

  if (taskIdx === -1) return 'Сюжетник составил план истории.'

  const taskLine = lines.slice(taskIdx + 1).find((l) => l.trim().length > 0)

  if (!taskLine) return 'Сюжетник составил план истории.'

  return `Сюжетник составил план. Эмоциональная задача: ${taskLine.trim()}`
}

export function triggerPlanPhaseFromAnswers(
  storyId: number,
  seed: string,
  answers: Array<{ question: string; answer: string }>,
  universeSystemPrompt?: string,
  universeContext?: string,
  styleGuide?: string,
): void {
  setPipelineStatus(storyId, 'questions_answered')

  const qaBlock = answers
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join('\n')

  const seedWithAnswers = `SEED: ${seed}\n\nCLARIFYING Q&A:\n${qaBlock}`

  synthesizeSashaContext()
    .then((sashaContext) =>
      runPlotterOnly({
        seed: seedWithAnswers,
        storyId,
        models: defaultModels,
        promptVersions: defaultPromptVersions,
        ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
        ...(universeContext !== undefined ? { universeContext } : {}),
        ...(styleGuide !== undefined ? { styleGuide } : {}),
        ...(sashaContext !== null ? { sashaContext } : {}),
        onStepChange: (step) => setCurrentStep(storyId, step),
      }).then((result) => ({ result, sashaContext }))
    )
    .then(async ({ result }) => {
      const plotterSummary = extractPlotterSummary(result.planV1)
      setStepSummary(storyId, 'Plotter', plotterSummary)

      try {
        await db.insert(runSnapshots).values(buildPlotterOnlySnapshotInsert(storyId, result))

        await db.update(stories).set(buildPlotterOnlyStoriesUpdate(result)).where(eq(stories.id, storyId))

        setPipelineStatus(storyId, 'plan_ready')
      } catch (dbError) {
        console.error(`Failed to persist plan phase for storyId=${storyId}:`, dbError)
        setPipelineStatus(storyId, 'plan_failed')
      }
    })
    .catch((planError) => {
      setPipelineStatus(storyId, 'plan_failed')
      console.error(`Plan phase failed for storyId=${storyId}:`, planError)
    })
}
