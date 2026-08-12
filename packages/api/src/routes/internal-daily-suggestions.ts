import { Router } from 'express'
import { db } from '@bedtime/core/db/client'
import { storyGroups } from '@bedtime/core/db/schema'
import { generateStoryIdeasForUniverse } from '@bedtime/core/pipeline/generate-story-ideas'
import { generateTopicCandidatesForUniverse } from '@bedtime/core/pipeline/generate-topic-candidates'
import { haveDailySuggestionsRunToday } from '@bedtime/core/pipeline/check-daily-suggestions-ran-today'
import { Sentry } from '@bedtime/observability'

const router = Router()

let dailySuggestionsInProgress = false

export interface DailySuggestionsBatchResult {
  skipped: boolean
  skipReason?: 'in-flight' | 'already-run-today'
  universesProcessed: number
  ideasCreated: number
  topicsCreated: number
  universesFailed: number
}

export async function runDailySuggestionsBatch(): Promise<DailySuggestionsBatchResult> {
  if (dailySuggestionsInProgress) {
    console.warn('[daily-suggestions] skipped: previous batch still in flight on this instance')
    return { skipped: true, skipReason: 'in-flight', universesProcessed: 0, ideasCreated: 0, topicsCreated: 0, universesFailed: 0 }
  }

  dailySuggestionsInProgress = true

  try {
    if (await haveDailySuggestionsRunToday()) {
      console.warn('[daily-suggestions] skipped: suggestions already generated today')
      return { skipped: true, skipReason: 'already-run-today', universesProcessed: 0, ideasCreated: 0, topicsCreated: 0, universesFailed: 0 }
    }

    const universes = await db.select({ id: storyGroups.id }).from(storyGroups)

    let ideasCreated = 0
    let topicsCreated = 0
    let universesFailed = 0

    for (const universe of universes) {
      try {
        const ideaResult = await generateStoryIdeasForUniverse(universe.id)
        ideasCreated += ideaResult.ideaCount

        const topicResult = await generateTopicCandidatesForUniverse(universe.id)
        topicsCreated += topicResult.createdCount
      } catch (err) {
        universesFailed += 1
        console.error('[daily-suggestions] failed for universe', universe.id, err)
        Sentry.captureException(err, { tags: { universeId: String(universe.id) } })
      }
    }

    return { skipped: false, universesProcessed: universes.length, ideasCreated, topicsCreated, universesFailed }
  } finally {
    dailySuggestionsInProgress = false
  }
}

router.post('/', async (req, res) => {
  const secret = process.env['DAILY_SUGGESTIONS_SECRET']
  const incoming = req.headers['x-daily-suggestions-secret']

  if (!secret || incoming !== secret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const result = await runDailySuggestionsBatch()
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[daily-suggestions] scheduled endpoint failed:', err)
    Sentry.captureException(err)
    res.status(500).json({ error: 'Daily suggestions failed' })
  }
})

export default router
