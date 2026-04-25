import { eq, desc } from 'drizzle-orm'
import { runPlanPhase, runTextPhase } from '@bedtime/core/pipeline/orchestrator'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer'
import { generateTextChangeSummary } from '@bedtime/core/pipeline/text-change-summarizer'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories } from '@bedtime/core/db/schema'
import {
  buildPlanSnapshotInsert,
  buildPlanStoriesUpdate,
  buildTextSnapshotUpdate,
  buildTextStoriesUpdate,
} from './pipeline-persistence'
import { setPipelineStatus, setCurrentStep } from './pipeline-state'
import { defaultPromptVersions, resolvePipelineModels } from './pipeline-defaults'

export function triggerTextRedoWithAnnotations(
  storyId: number,
  seedWithContext: string,
  previousText: string,
  annotationFeedback: string,
  universeSystemPrompt?: string,
  universeContext?: string,
  styleGuide?: string,
  universeId: number | null = null,
): void {
  setPipelineStatus(storyId, 'plan_running')

  Promise.all([synthesizeSashaContext(), resolvePipelineModels(universeId)])
    .then(([sashaContext, models]) =>
      runPlanPhase({
        seed: seedWithContext,
        storyId,
        models,
        promptVersions: defaultPromptVersions,
        ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
        ...(universeContext !== undefined ? { universeContext } : {}),
        ...(styleGuide !== undefined ? { styleGuide } : {}),
        ...(sashaContext !== null ? { sashaContext } : {}),
        onStepChange: (step) => setCurrentStep(storyId, step),
      }).then((plan) => ({ plan, sashaContext, models })),
    )
    .then(async ({ plan, sashaContext, models }) => {
      await db.insert(runSnapshots).values(buildPlanSnapshotInsert(storyId, plan))

      await db.update(stories).set(buildPlanStoriesUpdate(plan)).where(eq(stories.id, storyId))

      return { plan, sashaContext, models }
    })
    .then(async ({ plan, sashaContext, models }) => {
      setPipelineStatus(storyId, 'text_running')

      const text = await runTextPhase({
        seed: seedWithContext,
        planFinal: plan.planFinal,
        storyId,
        models,
        promptVersions: defaultPromptVersions,
        ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
        ...(universeContext !== undefined ? { universeContext } : {}),
        ...(styleGuide !== undefined ? { styleGuide } : {}),
        ...(sashaContext !== null && sashaContext !== undefined ? { sashaContext } : {}),
        onStepChange: (step) => setCurrentStep(storyId, step),
      })

      const [existing] = await db
        .select()
        .from(runSnapshots)
        .where(eq(runSnapshots.storyId, storyId))
        .orderBy(desc(runSnapshots.createdAt))
        .limit(1)

      if (existing) {
        await db
          .update(runSnapshots)
          .set(buildTextSnapshotUpdate(text))
          .where(eq(runSnapshots.id, existing.id))
      }

      await db.update(stories).set(buildTextStoriesUpdate(text)).where(eq(stories.id, storyId))

      const summary = await generateTextChangeSummary({
        previousText,
        newText: text.textV2,
        annotationFeedback,
        model: models.writer,
      })

      await db.update(stories).set({ textChangeSummary: summary, updatedAt: new Date() }).where(eq(stories.id, storyId))

      setPipelineStatus(storyId, 'text_review')
    })
    .catch((err) => {
      setPipelineStatus(storyId, 'text_failed')
      console.error(`Text redo failed for storyId=${storyId}:`, err)
    })
}
