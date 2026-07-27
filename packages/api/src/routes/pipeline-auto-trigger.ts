import { eq } from 'drizzle-orm'
import { runPlanPhase } from '@bedtime/core/pipeline/orchestrator'
import { recordStoryFragments } from '@bedtime/core/pipeline/load-fragments'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer'
import { db } from '@bedtime/core/db/client'
import { runSnapshots, stories } from '@bedtime/core/db/schema'
import {
  buildPlanSnapshotInsert,
  buildPlanStoriesUpdate,
} from './pipeline-persistence'
import { setPipelineStatus, setCurrentStep } from './pipeline-state'
import { defaultPromptVersions, resolvePipelineModels, loadStoryOverrides } from './pipeline-defaults'
import { runTextPhaseDurable } from './pipeline-text-trigger'
import { loadUniverseContext } from './load-universe-context'
import { withPipelineTrace } from '@bedtime/observability'

export interface AutoPipelineParams {
  storyId: number
  seed: string
  universeSystemPrompt?: string | undefined
  universeContext?: string | undefined
  styleGuide?: string | undefined
  universeIds?: number[] | undefined
}

export async function runAutoPipeline(params: AutoPipelineParams): Promise<void> {
  const { storyId, seed, universeSystemPrompt, universeContext, styleGuide, universeIds = [] } = params
  const primaryUniverseId = universeIds[0] ?? null

  setPipelineStatus(storyId, 'plan_running')

  await withPipelineTrace(String(storyId), async () => {
    let planFinal: string
    let sashaContext: string | null
    let effectiveSystemPrompt: string | undefined
    let effectiveUniverseContext: string | undefined
    let effectiveStyleGuide: string | undefined

    try {
      const [sasha, models, enrichedContext] = await Promise.all([
        synthesizeSashaContext(),
        loadStoryOverrides(storyId).then((overrides) => resolvePipelineModels(primaryUniverseId, overrides)),
        loadUniverseContext(universeIds),
      ])

      sashaContext = sasha
      effectiveSystemPrompt = enrichedContext?.universeSystemPrompt ?? universeSystemPrompt
      effectiveUniverseContext = enrichedContext?.universeContext ?? universeContext
      effectiveStyleGuide = enrichedContext?.styleGuide ?? styleGuide
      const bibleCharacters = enrichedContext?.bibleCharacters ?? []

      const plan = await runPlanPhase({
        seed,
        storyId,
        models,
        promptVersions: defaultPromptVersions,
        universeIds,
        injectFragments: true,
        ...(effectiveSystemPrompt !== undefined ? { universeSystemPrompt: effectiveSystemPrompt } : {}),
        ...(effectiveUniverseContext !== undefined ? { universeContext: effectiveUniverseContext } : {}),
        ...(effectiveStyleGuide !== undefined ? { styleGuide: effectiveStyleGuide } : {}),
        ...(sashaContext !== null ? { sashaContext } : {}),
        ...(bibleCharacters.length > 0 ? { bibleCharacters } : {}),
        onStepChange: (step) => setCurrentStep(storyId, step),
      })

      planFinal = plan.planFinal

      await db.insert(runSnapshots).values(buildPlanSnapshotInsert(storyId, plan))
      await db.update(stories).set(buildPlanStoriesUpdate(plan)).where(eq(stories.id, storyId))
      await recordStoryFragments(storyId, plan.usedFragmentIds)
    } catch (planError) {
      console.error(`Auto pipeline plan phase failed for storyId=${storyId}:`, planError)
      setPipelineStatus(storyId, 'plan_failed')
      throw planError
    }

    await runTextPhaseDurable({
      storyId,
      seed,
      planFinal,
      mode: 'auto',
      universeSystemPrompt: effectiveSystemPrompt,
      sashaContext,
      universeContext: effectiveUniverseContext,
      styleGuide: effectiveStyleGuide,
      universeIds,
    })
  })
}

export function triggerAutoPipeline(params: AutoPipelineParams): void {
  void runAutoPipeline(params).catch((err) => {
    console.error(`Auto pipeline failed for storyId=${params.storyId}:`, err)
  })
}
