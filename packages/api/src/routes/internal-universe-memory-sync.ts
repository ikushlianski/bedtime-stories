import { Router } from 'express'
import { db } from '@bedtime/core/db/client'
import { storyGroups } from '@bedtime/core/db/schema'
import { syncUniverseMemory } from '@bedtime/core/pipeline/synthesize-universe-memory'
import { Sentry } from '@bedtime/observability'

const router = Router()

let syncInProgress = false

export interface UniverseMemorySyncBatchResult {
  skipped: boolean
  universesProcessed: number
  universesUpdated: number
  universesFailed: number
}

export async function runUniverseMemorySyncBatch(): Promise<UniverseMemorySyncBatchResult> {
  if (syncInProgress) {
    console.warn('[universe-memory-sync] skipped: previous batch still in flight on this instance')
    return { skipped: true, universesProcessed: 0, universesUpdated: 0, universesFailed: 0 }
  }

  syncInProgress = true

  try {
    const universes = await db.select({ id: storyGroups.id }).from(storyGroups)

    let universesUpdated = 0
    let universesFailed = 0

    for (const universe of universes) {
      try {
        const result = await syncUniverseMemory(universe.id)

        if (result.updated) {
          universesUpdated += 1
        }
      } catch (err) {
        universesFailed += 1
        console.error('[universe-memory-sync] failed for universe', universe.id, err)
        Sentry.captureException(err, { tags: { universeId: String(universe.id) } })
      }
    }

    return { skipped: false, universesProcessed: universes.length, universesUpdated, universesFailed }
  } finally {
    syncInProgress = false
  }
}

router.post('/', async (req, res) => {
  const secret = process.env['UNIVERSE_MEMORY_SYNC_SECRET']
  const incoming = req.headers['x-universe-memory-sync-secret']

  if (!secret || incoming !== secret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const result = await runUniverseMemorySyncBatch()
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[universe-memory-sync] scheduled endpoint failed:', err)
    Sentry.captureException(err)
    res.status(500).json({ error: 'Sync failed' })
  }
})

export default router
