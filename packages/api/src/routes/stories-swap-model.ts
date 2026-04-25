import { Router, type Request } from 'express'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, storyGroups, runSnapshots, modelSwapEvents } from '@bedtime/core/db/schema'
import { validate } from '../middleware/validate'
import { triggerPlanRedo } from './pipeline-plan-redo'
import { triggerTextPhase } from './pipeline-text-trigger'
import type { StageOverrides } from '@bedtime/core/pipeline/derivers/per-stage-models'

const ORCHESTRATOR_STAGES = ['plotter', 'writer'] as const
type OrchestratorStage = (typeof ORCHESTRATOR_STAGES)[number]

const REASON_CHIPS = ['too_verbose', 'too_short', 'broke_format', 'boring_prose', 'off_topic', 'repetitive', 'not_calm', 'weak_ending', 'too_slow', 'failed', 'other'] as const

const swapModelSchema = z
  .object({
    stage: z.enum(ORCHESTRATOR_STAGES),
    toModel: z.string().min(1),
    reasonChip: z.enum(REASON_CHIPS).optional(),
    reasonText: z.string().optional(),
  })
  .refine(
    (v) => (v.reasonChip !== undefined && v.reasonChip.length > 0) || (v.reasonText !== undefined && v.reasonText.trim().length > 0),
    { message: 'reasonChip or reasonText must be provided' },
  )

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

    const currentOverrides = (storyRow.agentOverrides as StageOverrides | null) ?? {}
    const nextOverrides: StageOverrides = {
      ...currentOverrides,
      [stage]: { ...(currentOverrides[stage] ?? {}), model: body.toModel },
    }

    await db.transaction(async (tx) => {
      await tx.insert(modelSwapEvents).values({
        storyId,
        stage,
        fromModel,
        toModel: body.toModel,
        reasonChip: body.reasonChip ?? null,
        reasonText: body.reasonText ?? null,
      })

      await tx.update(stories).set({ agentOverrides: nextOverrides }).where(eq(stories.id, storyId))
    })

    console.log(`[swap] story_id=${storyId} stage=${stage} from=${fromModel ?? 'none'} to=${body.toModel} chip=${body.reasonChip ?? 'none'}`)

    let universeSystemPrompt: string | undefined
    let universeContext: string | undefined
    let styleGuide: string | undefined

    if (storyRow.groupId !== null && storyRow.groupId !== undefined) {
      const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, storyRow.groupId)).limit(1)
      if (group) {
        universeSystemPrompt = group.systemPrompt
        universeContext = group.universeContext ?? undefined
        styleGuide = group.styleGuide ?? undefined
      }
    }

    setImmediate(() => {
      if (stage === 'plotter') {
        triggerPlanRedo(
          storyId,
          storyRow.seed ?? '',
          storyRow.planFinal ?? storyRow.planV1 ?? '',
          universeSystemPrompt,
          universeContext,
          styleGuide,
          storyRow.groupId ?? null,
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
          storyRow.groupId ?? null,
        )
      }
    })

    res.status(201).json({ swapped: true, stage, fromModel, toModel: body.toModel })
  } catch (err) {
    console.error('POST /stories/:id/swap-model failed:', err)
    res.status(500).json({ error: 'Failed to swap model' })
  }
})

export default router
