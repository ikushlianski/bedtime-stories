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
import { defaultPromptVersions, resolvePipelineModels, loadStoryOverrides } from './pipeline-defaults'
import { triggerTextPhase } from './pipeline-text-trigger'
import { withPipelineTrace } from '@bedtime/observability'

export function triggerAutoPipeline(
  storyId: number,
  seed: string,
  universeSystemPrompt?: string,
  universeContext?: string,
  styleGuide?: string,
  universeId: number | null = null,
): void {
  setPipelineStatus(storyId, 'plan_running')

  withPipelineTrace(String(storyId), async () => {
    const [sashaContext, models] = await Promise.all([
      synthesizeSashaContext(),
      loadStoryOverrides(storyId).then((overrides) => resolvePipelineModels(universeId, overrides)),
    ])

    const plan = await runPlanPhase({
      seed,
      storyId,
      models,
      promptVersions: defaultPromptVersions,
      ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
      ...(universeContext !== undefined ? { universeContext } : {}),
      ...(styleGuide !== undefined ? { styleGuide } : {}),
      ...(sashaContext !== null ? { sashaContext } : {}),
      onStepChange: (step) => setCurrentStep(storyId, step),
    })

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
  }).catch((err) => {
    setPipelineStatus(storyId, 'plan_failed')
    console.error(`Auto pipeline plan phase failed for storyId=${storyId}:`, err)
  })
}
