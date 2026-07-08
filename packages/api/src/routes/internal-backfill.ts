import { Router } from 'express'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories } from '@bedtime/core/db/schema'
import type { PipelineInternalStatus } from './pipeline-status'
import { getPipelineStatus } from './pipeline-state'
import { triggerAutoPipeline } from './pipeline-auto-trigger'

const RETRIABLE_STATUSES: ReadonlySet<PipelineInternalStatus> = new Set([
  'plan_failed',
  'text_failed',
  'questions_failed',
])

interface BackfillBody {
  storyIds?: number[]
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
    const limit = typeof body.limit === 'number' && body.limit > 0 ? Math.min(body.limit, 200) : 100

    const stalled = await db
      .select()
      .from(stories)
      .where(
        and(
          eq(stories.status, 'draft'),
          eq(stories.source, 'agent'),
          eq(stories.mode, 'auto'),
          isNull(stories.planFinal),
        ),
      )

    const candidates = stalled
      .filter((s) => typeof s.seed === 'string' && s.seed.trim().length > 0)
      .filter((s) => (Array.isArray(body.storyIds) ? body.storyIds.includes(s.id) : true))
      .slice(0, limit)

    const triggered: number[] = []
    const skipped: Array<{ id: number; reason: string }> = []

    for (const story of candidates) {
      const status = getPipelineStatus(story.id)

      if (status !== undefined && !RETRIABLE_STATUSES.has(status)) {
        skipped.push({ id: story.id, reason: `in progress (${status})` })
        continue
      }

      triggerAutoPipeline(story.id, story.seed as string, undefined, undefined, undefined, story.groupId ?? null)
      triggered.push(story.id)
    }

    res.json({
      ok: true,
      totalStalled: stalled.length,
      triggeredCount: triggered.length,
      triggered,
      skipped,
    })
  } catch (err) {
    console.error('[backfill] internal endpoint failed:', err)
    res.status(500).json({ error: 'Backfill failed' })
  }
})

export default router
