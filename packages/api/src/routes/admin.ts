import { Router } from 'express'
import { sql, gte, eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import {
  modelCalls,
  modelSwapEvents,
  stories,
  runSnapshots,
  valueForMoneyFeedback,
  parentReviews,
  childReactions,
} from '@bedtime/core/db/schema'
import { deriveSpendOverTime, type SpendCallRow } from '@bedtime/core/cost/aggregations/derive-spend-over-time'
import { deriveJoyPerDollar, type JoyPerDollarStoryRow } from '@bedtime/core/cost/aggregations/derive-joy-per-dollar'
import { derivePlanIterationsPerModel, type PlanIterationsRow } from '@bedtime/core/cost/aggregations/derive-plan-iterations-per-model'
import { deriveSwapRatePerModel } from '@bedtime/core/cost/aggregations/derive-swap-rate-per-model'
import { deriveTokensPerChar } from '@bedtime/core/cost/aggregations/derive-tokens-per-char'
import { deriveFreeTierCompletionRate, type StoryCallsRow } from '@bedtime/core/cost/aggregations/derive-free-tier-completion-rate'
import { deriveAwaitingFeedbackInbox, type AwaitingInboxStoryRow } from '@bedtime/core/cost/aggregations/derive-awaiting-feedback-inbox'
import { deriveStoriesTable, type StoriesTableInputRow } from '@bedtime/core/cost/aggregations/derive-stories-table'

const router = Router()

const STAGE_MODEL_COLUMNS: Array<keyof typeof runSnapshots._.columns> = [
  'plotterModel',
  'plotCriticModel',
  'writerModel',
  'writerCriticModel',
  'psychologistPlanModel',
  'psychologistTextModel',
]

router.get('/spend-over-time', async (_req, res) => {
  try {
    const since = new Date()
    since.setUTCDate(1)
    since.setUTCHours(0, 0, 0, 0)

    const rows = await db
      .select({ modelId: modelCalls.modelId, usdMicros: modelCalls.usdMicros, createdAt: modelCalls.createdAt })
      .from(modelCalls)
      .where(gte(modelCalls.createdAt, since))

    const input: SpendCallRow[] = rows
      .filter((r): r is { modelId: string | null; usdMicros: number; createdAt: Date } => r.createdAt !== null && r.usdMicros !== null)
      .map((r) => ({ modelId: r.modelId, usdMicros: Number(r.usdMicros), createdAt: r.createdAt }))

    res.json(deriveSpendOverTime(input))
  } catch (err) {
    console.error('GET /admin/spend-over-time failed:', err)
    res.status(500).json({ error: 'Failed to load spend' })
  }
})

router.get('/awaiting-feedback', async (_req, res) => {
  try {
    const rows = await db
      .select({
        storyId: stories.id,
        title: stories.title,
        status: stories.status,
        readyAt: stories.readyAt,
        feedbackId: valueForMoneyFeedback.id,
      })
      .from(stories)
      .leftJoin(valueForMoneyFeedback, eq(valueForMoneyFeedback.storyId, stories.id))
      .where(sql`${stories.status} in ('ready','read')`)

    const input: AwaitingInboxStoryRow[] = rows.map((r) => ({
      storyId: r.storyId,
      title: r.title,
      status: r.status ?? 'draft',
      readyAt: r.readyAt,
      hasFeedback: r.feedbackId !== null,
    }))

    res.json(deriveAwaitingFeedbackInbox(input))
  } catch (err) {
    console.error('GET /admin/awaiting-feedback failed:', err)
    res.status(500).json({ error: 'Failed to load inbox' })
  }
})

router.get('/model-leaderboard', async (_req, res) => {
  try {
    const [storyRows, ratingRows, calls, snaps, swapEvents, tokensPerCharRows] = await Promise.all([
      db.select({ id: stories.id, planIterations: stories.planIterations, plotterModel: stories.plotterModel }).from(stories),
      db
        .select({
          storyId: stories.id,
          parentRating: parentReviews.rating,
          childEnjoyed: childReactions.enjoyed,
        })
        .from(stories)
        .leftJoin(parentReviews, eq(parentReviews.storyId, stories.id))
        .leftJoin(childReactions, eq(childReactions.storyId, stories.id)),
      db.select({ storyId: modelCalls.storyId, usdMicros: modelCalls.usdMicros, modelId: modelCalls.modelId }).from(modelCalls),
      db.select().from(runSnapshots),
      db.select({ storyId: modelSwapEvents.storyId, fromModel: modelSwapEvents.fromModel }).from(modelSwapEvents),
      db
        .select({
          model: modelCalls.modelId,
          sumTokensOut: sql<number>`coalesce(sum(${modelCalls.tokensOut}), 0)::int`,
          sumOutputChars: sql<number>`coalesce(sum(coalesce(length(${stories.textV2}), length(${stories.textV1}), 0)), 0)::int`,
        })
        .from(modelCalls)
        .leftJoin(stories, eq(stories.id, modelCalls.storyId))
        .where(sql`${modelCalls.modelId} is not null and ${modelCalls.stage} = 'writer'`)
        .groupBy(modelCalls.modelId),
    ])

    const stageModelsByStory = new Map<number, Set<string>>()
    for (const s of snaps) {
      if (s.storyId === null) continue
      const models = STAGE_MODEL_COLUMNS
        .map((col) => s[col] as string | null)
        .filter((m): m is string => m !== null && m.length > 0)
      const existing = stageModelsByStory.get(s.storyId) ?? new Set<string>()
      for (const m of models) existing.add(m)
      stageModelsByStory.set(s.storyId, existing)
    }

    const usdMicrosByStory = new Map<number, number>()
    for (const c of calls) {
      if (c.storyId === null || c.usdMicros === null) continue
      usdMicrosByStory.set(c.storyId, (usdMicrosByStory.get(c.storyId) ?? 0) + Number(c.usdMicros))
    }

    const ratingByStory = new Map<number, { parent: number | null; child: number | null }>()
    for (const r of ratingRows) {
      ratingByStory.set(r.storyId, { parent: r.parentRating, child: r.childEnjoyed })
    }

    const joyInput: JoyPerDollarStoryRow[] = storyRows.map((s) => {
      const rating = ratingByStory.get(s.id) ?? { parent: null, child: null }
      const models = Array.from(stageModelsByStory.get(s.id) ?? [])
      return {
        storyId: s.id,
        models,
        parentRating: rating.parent,
        childEnjoyed: rating.child,
        totalUsdMicros: usdMicrosByStory.get(s.id) ?? 0,
      }
    })

    const planIterationsInput: PlanIterationsRow[] = storyRows.map((s) => ({
      storyId: s.id,
      plotterModel: s.plotterModel,
      planIterations: s.planIterations,
    }))

    const swapInput = swapEvents.map((e) => ({ storyId: e.storyId ?? 0, fromModel: e.fromModel }))
    const stageModelsInput = Array.from(stageModelsByStory.entries()).map(([storyId, models]) => ({
      storyId,
      models: Array.from(models),
    }))

    const callsByStoryArr: StoryCallsRow[] = storyRows.map((s) => {
      const usds = calls.filter((c) => c.storyId === s.id && c.usdMicros !== null).map((c) => Number(c.usdMicros))
      return { storyId: s.id, callUsdMicros: usds }
    })

    res.json({
      joyPerDollar: deriveJoyPerDollar(joyInput),
      planIterationsPerModel: derivePlanIterationsPerModel(planIterationsInput),
      swapRatePerModel: deriveSwapRatePerModel(swapInput, stageModelsInput),
      tokensPerChar: deriveTokensPerChar(
        tokensPerCharRows
          .filter((r): r is { model: string; sumTokensOut: number; sumOutputChars: number } => r.model !== null)
          .map((r) => ({ model: r.model, sumTokensOut: Number(r.sumTokensOut), sumOutputChars: Number(r.sumOutputChars) })),
      ),
      freeTierCompletionRate: deriveFreeTierCompletionRate(callsByStoryArr),
    })
  } catch (err) {
    console.error('GET /admin/model-leaderboard failed:', err)
    res.status(500).json({ error: 'Failed to load leaderboard' })
  }
})

router.get('/stories-table', async (_req, res) => {
  try {
    const [storyRows, calls, snaps, ratingRows] = await Promise.all([
      db.select({ id: stories.id, title: stories.title, createdAt: stories.createdAt }).from(stories),
      db
        .select({ storyId: modelCalls.storyId, usdMicros: modelCalls.usdMicros, tokensIn: modelCalls.tokensIn, tokensOut: modelCalls.tokensOut })
        .from(modelCalls),
      db.select().from(runSnapshots),
      db
        .select({
          storyId: stories.id,
          parentRating: parentReviews.rating,
          childEnjoyed: childReactions.enjoyed,
        })
        .from(stories)
        .leftJoin(parentReviews, eq(parentReviews.storyId, stories.id))
        .leftJoin(childReactions, eq(childReactions.storyId, stories.id)),
    ])

    const usdByStory = new Map<number, { usdMicros: number; tokens: number; hasCalls: boolean }>()
    for (const c of calls) {
      if (c.storyId === null || c.usdMicros === null) continue
      const entry = usdByStory.get(c.storyId) ?? { usdMicros: 0, tokens: 0, hasCalls: false }
      entry.usdMicros += Number(c.usdMicros)
      entry.tokens += (c.tokensIn ?? 0) + (c.tokensOut ?? 0)
      entry.hasCalls = true
      usdByStory.set(c.storyId, entry)
    }

    const snapByStory = new Map<number, Record<string, string | null>>()
    for (const s of snaps) {
      if (s.storyId === null) continue
      snapByStory.set(s.storyId, {
        plotter: s.plotterModel,
        plotCritic: s.plotCriticModel,
        writer: s.writerModel,
        writerCritic: s.writerCriticModel,
        psychologistPlan: s.psychologistPlanModel,
        psychologistText: s.psychologistTextModel,
      })
    }

    const ratingByStory = new Map<number, { parent: number | null; child: number | null }>()
    for (const r of ratingRows) {
      ratingByStory.set(r.storyId, { parent: r.parentRating, child: r.childEnjoyed })
    }

    const input: StoriesTableInputRow[] = storyRows.map((s) => {
      const cost = usdByStory.get(s.id)
      const rating = ratingByStory.get(s.id) ?? { parent: null, child: null }
      return {
        storyId: s.id,
        title: s.title,
        createdAt: s.createdAt,
        modelsPerStage: snapByStory.get(s.id) ?? {},
        totalTokens: cost?.tokens ?? 0,
        totalUsdMicros: cost?.hasCalls ? cost.usdMicros : null,
        parentRating: rating.parent,
        childRating: rating.child,
      }
    })

    res.json(deriveStoriesTable(input))
  } catch (err) {
    console.error('GET /admin/stories-table failed:', err)
    res.status(500).json({ error: 'Failed to load stories table' })
  }
})

export default router
