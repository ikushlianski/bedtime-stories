import { eq } from 'drizzle-orm'
import { runPlanPhase } from '@bedtime/core/pipeline/orchestrator'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories } from '@bedtime/core/db/schema'
import {
  buildPlanSnapshotInsert,
  buildPlanStoriesUpdate,
} from './pipeline-persistence'
import { setPipelineStatus, setCurrentStep } from './pipeline-state'
import { defaultModels, defaultPromptVersions } from './pipeline-defaults'

export function triggerPlanPhaseFromAnswers(
  storyId: number,
  seed: string,
  answers: Array<{ question: string; answer: string }>,
  universeSystemPrompt?: string,
  universeContext?: string,
): void {
  setPipelineStatus(storyId, 'questions_answered')

  const qaBlock = answers
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join('\n')

  const seedWithAnswers = `SEED: ${seed}\n\nCLARIFYING Q&A:\n${qaBlock}`

  synthesizeSashaContext()
    .then((sashaContext) =>
      runPlanPhase({
        seed: seedWithAnswers,
        storyId,
        models: defaultModels,
        promptVersions: defaultPromptVersions,
        ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
        ...(universeContext !== undefined ? { universeContext } : {}),
        ...(sashaContext !== null ? { sashaContext } : {}),
        onStepChange: (step) => setCurrentStep(storyId, step),
      })
    )
    .then(async (plan) => {
      try {
        await db.insert(runSnapshots).values(buildPlanSnapshotInsert(storyId, plan))

        await db.update(stories).set(buildPlanStoriesUpdate(plan)).where(eq(stories.id, storyId))

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
