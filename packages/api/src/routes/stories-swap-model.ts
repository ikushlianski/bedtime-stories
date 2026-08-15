import { Router, type Request } from 'express'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, runSnapshots, modelSwapEvents } from '@bedtime/core/db/schema'
import { validate } from '../middleware/validate'
import { triggerPlanRedo } from './pipeline-plan-redo'
import { triggerTextPhase } from './pipeline-text-trigger'
import { getStoryUniverseIds } from './story-universe-links'
import { loadUniverseContext } from './load-universe-context'
import type { StageOverrides } from '@bedtime/core/pipeline/derivers/per-stage-models'

const ORCHESTRATOR_STAGES = ['plotter', 'writer'] as const
type OrchestratorStage = (typeof ORCHESTRATOR_STAGES)[number]

const REASON_CHIPS = ['too_verbose', 'too_short', 'broke_format', 'boring_prose', 'off_topic', 'repetitive', 'not_calm', 'weak_ending', 'too_slow', 'failed', 'other'] as const

const swapModelSchema = z.object({
  stage: z.enum(ORCHESTRATOR_STAGES),
  toModel: z.string().min(1).optional(),
  reasonChip: z.enum(REASON_CHIPS).optional(),
  reasonText: z.string().optional(),
})

const SNAPSHOT_MODEL_COLUMN: Record<OrchestratorStage, keyof typeof runSnapshots._.columns> = {
  plotter: 'plotterModel',
  writer: 'writerModel',
}

type StoryParams = { id: string }

const router = Router({ mergeParams: true })

router.post('/', validate(swapModelSchema), async (req: Request<StoryParams>, res) => {
  const storyId = parseInt(req.params['id'] ?? '', 10)

  if (isNaN(storyId)) {
    res.status(400).json({ error: 'Invalid story id' })
    return
  }

  const body = req.body as z.infer<typeof swapModelSchema>
  const stage = body.stage as OrchestratorStage

  try {
    const [storyRow] = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1)

    if (!storyRow) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    const [snapshot] = await db
      .select()
      .from(runSnapshots)
      .where(eq(runSnapshots.storyId, storyId))
      .orderBy(desc(runSnapshots.createdAt))
      .limit(1)

    const fromModel = snapshot ? (snapshot[SNAPSHOT_MODEL_COLUMN[stage]] as string | null) : null
    const requestedModel = body.toModel ?? null
    const effectiveModel = requestedModel ?? fromModel

    const currentOverrides = (storyRow.agentOverrides as StageOverrides | null) ?? {}
    const nextOverrides: StageOverrides = requestedModel
      ? { ...currentOverrides, [stage]: { ...(currentOverrides[stage] ?? {}), model: requestedModel } }
      : currentOverrides

    await db.batch([
      db.insert(modelSwapEvents).values({
        storyId,
        stage,
        fromModel,
        toModel: effectiveModel,
        reasonChip: body.reasonChip ?? null,
        reasonText: body.reasonText ?? null,
      }),
      db.update(stories).set({ agentOverrides: nextOverrides }).where(eq(stories.id, storyId)),
    ])

    console.log(`[swap] story_id=${storyId} stage=${stage} from=${fromModel ?? 'none'} to=${effectiveModel ?? 'unchanged'} chip=${body.reasonChip ?? 'none'}`)

    const universeIds = await getStoryUniverseIds(storyId, storyRow.groupId)
    const { universeSystemPrompt, universeContext, styleGuide } = await loadUniverseContext(universeIds)

    setImmediate(() => {
      if (stage === 'plotter') {
        triggerPlanRedo(
          storyId,
          storyRow.seed ?? '',
          storyRow.planFinal ?? storyRow.planV1 ?? '',
          universeSystemPrompt,
          universeContext,
          styleGuide,
          universeIds,
        )
      } else {
        triggerTextPhase(
          storyId,
          storyRow.seed ?? '',
          storyRow.planFinal ?? storyRow.planV1 ?? '',
          storyRow.mode ?? 'auto',
          universeSystemPrompt,
          null,
          universeContext,
          styleGuide,
          universeIds,
          storyRow.textV1 ?? undefined,
          storyRow.activeTextVersionId ?? null,
        )
      }
    })

    res.status(201).json({ swapped: true, stage, fromModel, toModel: effectiveModel })
  } catch (err) {
    console.error('POST /stories/:id/swap-model failed:', err)
    res.status(500).json({ error: 'Failed to swap model' })
  }
})

export default router
