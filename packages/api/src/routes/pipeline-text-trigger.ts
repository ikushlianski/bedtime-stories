import { eq, desc } from 'drizzle-orm'
import { runTextPhase, type TextPhaseResult } from '@bedtime/core/pipeline/orchestrator'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories } from '@bedtime/core/db/schema'
import {
  buildTextSnapshotUpdate,
  buildTextStoriesUpdate,
} from './pipeline-persistence'
import { getPipelineStatus, setPipelineStatus, setCurrentStep } from './pipeline-state'
import { defaultModels, defaultPromptVersions } from './pipeline-defaults'

export { getPipelineStatus, setPipelineStatus }

async function persistTextPhase(storyId: number, text: TextPhaseResult): Promise<void> {
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
}

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

  runTextPhase({
    seed,
    planFinal,
    storyId,
    models: defaultModels,
    promptVersions: defaultPromptVersions,
    ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
    ...(universeContext !== undefined ? { universeContext } : {}),
    ...(styleGuide !== undefined ? { styleGuide } : {}),
    ...(sashaContext !== undefined && sashaContext !== null ? { sashaContext } : {}),
    onStepChange: (step) => setCurrentStep(storyId, step),
  })
    .then(async (text) => {
      try {
        await persistTextPhase(storyId, text)

        if (mode === 'auto') {
          await db.update(stories).set({ status: 'ready' }).where(eq(stories.id, storyId))
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
