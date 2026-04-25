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
import { defaultPromptVersions, resolvePipelineModels } from './pipeline-defaults'
import { triggerTextPhase } from './pipeline-text-trigger'

export function triggerAutoPipeline(
  storyId: number,
  seed: string,
  universeSystemPrompt?: string,
  universeContext?: string,
  styleGuide?: string,
  universeId: number | null = null,
): void {
  setPipelineStatus(storyId, 'plan_running')

  Promise.all([synthesizeSashaContext(), resolvePipelineModels(universeId)])
    .then(([sashaContext, models]) =>
      runPlanPhase({
        seed,
        storyId,
        models,
        promptVersions: defaultPromptVersions,
        ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
        ...(universeContext !== undefined ? { universeContext } : {}),
        ...(styleGuide !== undefined ? { styleGuide } : {}),
        ...(sashaContext !== null ? { sashaContext } : {}),
        onStepChange: (step) => setCurrentStep(storyId, step),
      }).then((plan) => ({ plan, sashaContext })),
    )
    .then(async ({ plan, sashaContext }) => {
      try {
        await db.insert(runSnapshots).values(buildPlanSnapshotInsert(storyId, plan))

        await db.update(stories).set(buildPlanStoriesUpdate(plan)).where(eq(stories.id, storyId))

        triggerTextPhase(
          storyId,
          seed,
          plan.planFinal,
          'auto',
          universeSystemPrompt,
          sashaContext,
          universeContext,
          styleGuide,
          universeId,
        )
      } catch (dbError) {
        console.error(`Failed to persist plan phase (auto) for storyId=${storyId}:`, dbError)
        setPipelineStatus(storyId, 'plan_failed')
      }
    })
    .catch((err) => {
      setPipelineStatus(storyId, 'plan_failed')
      console.error(`Auto pipeline plan phase failed for storyId=${storyId}:`, err)
    })
}
