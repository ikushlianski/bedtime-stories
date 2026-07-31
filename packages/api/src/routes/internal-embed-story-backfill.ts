import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories } from '@bedtime/core/db/schema'
import { embedStoriesBatch, type EmbedStoriesBatchResult } from '@bedtime/core/pipeline/embed-story'

const router = Router()

export async function runEmbedStoryBackfill(): Promise<EmbedStoriesBatchResult> {
  const readStories = await db.select({ id: stories.id }).from(stories).where(eq(stories.status, 'read'))
  const storyIds = readStories.map((s) => s.id)

  return embedStoriesBatch(storyIds)
}

router.post('/', async (req, res) => {
  const secret = process.env['EMBEDDING_BACKFILL_SECRET']
  const incoming = req.headers['x-embedding-backfill-secret']

  if (!secret || incoming !== secret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const result = await runEmbedStoryBackfill()

    res.json({
      ok: true,
      embedded: result.embedded.length,
      skipped: result.skipped,
      failed: result.failed,
    })
  } catch (err) {
    console.error('[embed-story-backfill] internal endpoint failed:', err)
    res.status(500).json({ error: 'Backfill failed' })
  }
})

export default router
