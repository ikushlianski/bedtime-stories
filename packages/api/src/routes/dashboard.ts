import { Router } from 'express'
import { eq, desc, asc, and } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client.js'
import { stories, feedback, runSnapshots, annotations } from '@bedtime/core/db/schema.js'

const router = Router()

router.get('/quality-trend', async (_req, res) => {
  try {
    const rows = await db
      .select({
        storyId: stories.id,
        title: stories.title,
        createdAt: stories.createdAt,
        rating: feedback.rating,
        plotterPromptVersion: stories.plotterPromptVersion,
        writerPromptVersion: stories.writerPromptVersion,
        plotterModel: stories.plotterModel,
        writerModel: stories.writerModel,
      })
      .from(stories)
      .innerJoin(feedback, eq(feedback.storyId, stories.id))
      .orderBy(asc(stories.createdAt))

    res.json(rows)
  } catch (err) {
    console.error('GET /dashboard/quality-trend failed:', err)
    res.status(500).json({ error: 'Failed to fetch quality trend data' })
  }
})

router.get('/agent-effectiveness', async (_req, res) => {
  try {
    const rows = await db
      .select({
        storyId: stories.id,
        planIterationsCount: runSnapshots.planIterationsCount,
        planV1: runSnapshots.planV1,
        planFinal: runSnapshots.planFinal,
        textV1: runSnapshots.textV1,
        textV2: runSnapshots.textV2,
        psychologistPlanOutput: runSnapshots.psychologistPlanOutput,
        plotCriticOutput: runSnapshots.plotCriticOutput,
        writerCriticOutput: runSnapshots.writerCriticOutput,
        rating: feedback.rating,
      })
      .from(stories)
      .innerJoin(runSnapshots, eq(runSnapshots.storyId, stories.id))
      .innerJoin(feedback, eq(feedback.storyId, stories.id))

    const result = rows.map((row) => ({
      storyId: row.storyId,
      planIterationsCount: row.planIterationsCount,
      hasPlanDiff: row.planV1 !== row.planFinal,
      hasTextDiff: row.textV1 !== row.textV2,
      psychologistPlanOutput: row.psychologistPlanOutput,
      plotCriticOutput: row.plotCriticOutput,
      writerCriticOutput: row.writerCriticOutput,
      rating: row.rating,
    }))

    res.json(result)
  } catch (err) {
    console.error('GET /dashboard/agent-effectiveness failed:', err)
    res.status(500).json({ error: 'Failed to fetch agent effectiveness data' })
  }
})

router.get('/feedback-patterns', async (_req, res) => {
  try {
    const rows = await db
      .select({
        feedbackId: feedback.id,
        storyId: stories.id,
        title: stories.title,
        rating: feedback.rating,
        comment: feedback.comment,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .innerJoin(stories, eq(stories.id, feedback.storyId))
      .where(eq(feedback.feedbackType, 'agent_run'))
      .orderBy(desc(feedback.createdAt))
      .limit(50)

    res.json(rows)
  } catch (err) {
    console.error('GET /dashboard/feedback-patterns failed:', err)
    res.status(500).json({ error: 'Failed to fetch feedback patterns' })
  }
})

router.get('/sasha-reactions', async (_req, res) => {
  try {
    const rows = await db
      .select({
        storyId: stories.id,
        title: stories.title,
        annotationType: annotations.type,
        selectedText: annotations.selectedText,
        positionStart: annotations.positionStart,
        positionEnd: annotations.positionEnd,
        createdAt: annotations.createdAt,
      })
      .from(annotations)
      .innerJoin(stories, eq(stories.id, annotations.storyId))
      .where(eq(annotations.type, 'sasha_reaction'))
      .orderBy(desc(annotations.createdAt))

    res.json(rows)
  } catch (err) {
    console.error('GET /dashboard/sasha-reactions failed:', err)
    res.status(500).json({ error: 'Failed to fetch sasha reactions data' })
  }
})

router.get('/cost', async (_req, res) => {
  try {
    const rows = await db
      .select({
        storyId: stories.id,
        title: stories.title,
        planIterationsCount: runSnapshots.planIterationsCount,
        plotterModel: runSnapshots.plotterModel,
        writerModel: runSnapshots.writerModel,
        psychologistPlanModel: runSnapshots.psychologistPlanModel,
        plotCriticModel: runSnapshots.plotCriticModel,
        writerCriticModel: runSnapshots.writerCriticModel,
        createdAt: stories.createdAt,
      })
      .from(stories)
      .leftJoin(runSnapshots, eq(runSnapshots.storyId, stories.id))
      .orderBy(desc(stories.createdAt))

    res.json(rows)
  } catch (err) {
    console.error('GET /dashboard/cost failed:', err)
    res.status(500).json({ error: 'Failed to fetch cost data' })
  }
})

export default router
