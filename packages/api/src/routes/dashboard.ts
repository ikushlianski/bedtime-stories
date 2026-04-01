import { Router } from 'express'

// TODO: import { db } from '../db/client' when BE-1 is merged
// For now use a stub:
const db = null as any // will be replaced

const router = Router()

router.get('/quality-trend', async (_req, res) => {
  try {
    // DB: stub — replace with real db calls after merge
    const stories = await db
      .select()
      .from('stories')
      .leftJoin('feedback', 'stories.id', 'feedback.story_id')
      .leftJoin('run_snapshots', 'stories.id', 'run_snapshots.story_id')
      .orderBy('stories.created_at', 'asc')

    res.json(stories)
  } catch {
    res.status(500).json({ error: 'Failed to fetch quality trend data' })
  }
})

router.get('/feedback-patterns', async (_req, res) => {
  try {
    // DB: stub — replace with real db calls after merge
    const feedback = await db
      .select()
      .from('feedback')
      .leftJoin('stories', 'feedback.story_id', 'stories.id')
      .orderBy('feedback.created_at', 'desc')

    res.json(feedback)
  } catch {
    res.status(500).json({ error: 'Failed to fetch feedback patterns' })
  }
})

router.get('/cost', async (_req, res) => {
  try {
    // DB: stub — replace with real db calls after merge
    const stories = await db
      .select()
      .from('stories')
      .leftJoin('run_snapshots', 'stories.id', 'run_snapshots.story_id')
      .orderBy('stories.created_at', 'desc')

    res.json(stories)
  } catch {
    res.status(500).json({ error: 'Failed to fetch cost data' })
  }
})

router.get('/agent-effectiveness', async (_req, res) => {
  try {
    // DB: stub — returns placeholder shape
    res.json({
      stories: [
        {
          storyId: 0,
          planIterationsCount: 0,
          plotCriticOutput: null,
          writerCriticOutput: null,
        },
      ],
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch agent effectiveness data' })
  }
})

router.get('/sasha-reactions', async (_req, res) => {
  try {
    // DB: stub — returns placeholder shape
    res.json({
      byStory: [
        {
          storyId: 0,
          annotations: [],
        },
      ],
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch sasha reactions data' })
  }
})

export default router
