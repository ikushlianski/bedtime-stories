import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, storyImages } from '@bedtime/core/db/schema'
import { deriveBackfillCandidates } from '@bedtime/core/pipeline/derivers/backfill-candidates'
import { dispatchImageGeneration } from './pipeline-dispatch'

interface BackfillBody {
  limit?: number
}

const router = Router()

router.post('/', async (req, res) => {
  const secret = process.env['BACKFILL_SECRET']
  const incoming = req.headers['x-backfill-secret']

  if (!secret || incoming !== secret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const body = (req.body ?? {}) as BackfillBody
    const limit = typeof body.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 50) : 20

    const [readyStories, storiesWithImages] = await Promise.all([
      db.select({ id: stories.id }).from(stories).where(eq(stories.status, 'ready')),
      db.selectDistinct({ storyId: storyImages.storyId }).from(storyImages),
    ])

    const candidates = deriveBackfillCandidates({
      readyStoryIds: readyStories.map((s) => s.id),
      storyIdsWithImages: storiesWithImages.map((s) => s.storyId),
    }).slice(0, limit)

    for (const storyId of candidates) {
      void dispatchImageGeneration(storyId).catch((err) => {
        console.error(`[backfill-images] failed to dispatch for storyId=${storyId}:`, err)
      })
    }

    res.json({
      ok: true,
      totalReady: readyStories.length,
      alreadyBackfilled: storiesWithImages.length,
      triggeredCount: candidates.length,
      triggered: candidates,
    })
  } catch (err) {
    console.error('[backfill-images] internal endpoint failed:', err)
    res.status(500).json({ error: 'Backfill failed' })
  }
})

export default router
