import { eq } from 'drizzle-orm'
import { runPlotterOnly } from '@bedtime/core/pipeline/orchestrator'
import { recordStoryCharacters } from '@bedtime/core/pipeline/character-usage'
import { synthesizeSashaContext } from '@bedtime/core/pipeline/feedback-synthesizer'
import { generatePlanChangeSummary } from '@bedtime/core/pipeline/plan-change-summarizer'
import { resolveAnnotations } from '@bedtime/core/pipeline/annotation-resolver'
import { db } from '@bedtime/core/db/client'
import { annotations, runSnapshots, stories } from '@bedtime/core/db/schema'
import {
  buildPlotterOnlySnapshotInsert,
  buildPlotterOnlyStoriesUpdate,
} from './pipeline-persistence'
import { setPipelineStatus, setCurrentStep, setStepSummary } from './pipeline-state'
import { defaultPromptVersions, resolvePipelineModels, loadStoryOverrides } from './pipeline-defaults'
import { loadUniverseContext } from './load-universe-context'
import { gatherRedoFeedback } from './gather-redo-feedback'
import { withPipelineTrace } from '@bedtime/observability'

function extractPlotterSummary(planText: string): string {
  const lines = planText.split('\n')
  const taskIdx = lines.findIndex((l) => l.includes('ЭМОЦИОНАЛЬНАЯ ЗАДАЧА'))

  if (taskIdx === -1) return 'Сюжетник пересмотрел план истории.'

  const taskLine = lines.slice(taskIdx + 1).find((l) => l.trim().length > 0)

  if (!taskLine) return 'Сюжетник пересмотрел план истории.'

  return `Сюжетник пересмотрел план. Эмоциональная задача: ${taskLine.trim()}`
}

export function triggerPlanRedo(
  storyId: number,
  seed: string,
  previousPlan: string,
  universeSystemPrompt?: string,
  universeContext?: string,
  styleGuide?: string,
  universeIds: number[] = [],
  reason?: string,
  modelOverride?: string,
): void {
  setPipelineStatus(storyId, 'plan_running')
  const primaryUniverseId = universeIds[0] ?? null

  withPipelineTrace(String(storyId), async () => {
    const [feedback, resolvedModels, ctx] = await Promise.all([
      gatherRedoFeedback({ storyId, context: 'plan', reason, universeId: primaryUniverseId }),
      loadStoryOverrides(storyId).then((overrides) => resolvePipelineModels(primaryUniverseId, overrides)),
      loadUniverseContext(universeIds),
    ])
    const { models, fallbacks } = resolvedModels

    if (modelOverride) {
      models.plotter = modelOverride
    }

    const activeRows = feedback.annotationRows.filter((r) => r.noteText !== null) as Array<{ id: number; selectedText: string | null; noteText: string }>
    const userFeedback = feedback.userFeedback
    const sashaContext = await synthesizeSashaContext()
    const bibleCharacters = ctx?.bibleCharacters ?? []

    const result = await runPlotterOnly({
      seed,
      storyId,
      models,
      fallbacks,
      promptVersions: defaultPromptVersions,
      ...(universeSystemPrompt !== undefined ? { universeSystemPrompt } : {}),
      ...(universeContext !== undefined ? { universeContext } : {}),
      ...(styleGuide !== undefined ? { styleGuide } : {}),
      ...(sashaContext !== null ? { sashaContext } : {}),
      ...(userFeedback ? { userFeedback } : {}),
      ...(bibleCharacters.length > 0 ? { bibleCharacters } : {}),
      universeIds,
      onStepChange: (step) => setCurrentStep(storyId, step),
    })

    setStepSummary(storyId, 'Plotter', extractPlotterSummary(result.planV1))

    try {
      const [changeSummary, resolutionMap] = await Promise.all([
        generatePlanChangeSummary({
          previousPlan,
          newPlan: result.planV1,
          userFeedback,
          model: models.plotter,
        }),
        resolveAnnotations({
          previousVersion: previousPlan,
          newVersion: result.planV1,
          annotations: activeRows,
          model: models.plotter,
          versionLabel: 'план',
        }),
      ])

      const resolvedAt = new Date()

      await Promise.all(
        activeRows.map((row) => {
          const summary = resolutionMap.get(row.id) ?? null
          return db
            .update(annotations)
            .set({ resolvedAt, resolvedSummary: summary })
            .where(eq(annotations.id, row.id))
        }),
      )

      await db.insert(runSnapshots).values(buildPlotterOnlySnapshotInsert(storyId, result))

      await db
        .update(stories)
        .set({ ...buildPlotterOnlyStoriesUpdate(result), planChangeSummary: changeSummary })
        .where(eq(stories.id, storyId))

      await recordStoryCharacters(storyId, result.usedCharacterIds)

      setPipelineStatus(storyId, 'plan_ready')
    } catch (dbError) {
      console.error(`Failed to persist plan redo for storyId=${storyId}:`, dbError)
      setPipelineStatus(storyId, 'plan_failed')
    }
  }).catch((err) => {
    setPipelineStatus(storyId, 'plan_failed')
    console.error(`Plan redo failed for storyId=${storyId}:`, err)
  })
}
