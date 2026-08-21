import { Router } from 'express'
import { asc, eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { storyIllustrations } from '@bedtime/core/db/schema'
import { env } from '@bedtime/core/env'
import { buildPublicObjectUrl } from '@bedtime/core/character-portraits/build-public-object-url'
import { generateIllustrationAlbum } from '@bedtime/core/story-illustrations/generate-illustration-album'
import { objectStorage } from '../storage/gcs-object-storage'

const router = Router()

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

function toApiShape(row: typeof storyIllustrations.$inferSelect) {
  return {
    id: row.id,
    imageUrl: buildPublicObjectUrl({ bucketName: env.GCS_BUCKET_NAME, storagePath: row.storagePath }),
    momentDescription: row.momentDescription,
    source: row.source,
    orderIndex: row.orderIndex,
  }
}

router.get('/:id/illustrations', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const rows = await db
      .select()
      .from(storyIllustrations)
      .where(eq(storyIllustrations.storyId, storyId))
      .orderBy(asc(storyIllustrations.orderIndex))

    res.json(rows.map(toApiShape))
  } catch (err) {
    console.error('GET /stories/:id/illustrations failed:', err)
    res.status(500).json({ error: 'Failed to fetch illustrations' })
  }
})

router.post('/:id/illustrations/regenerate', async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const rows = await generateIllustrationAlbum(storyId, objectStorage, { force: true })

    res.status(201).json(rows.map(toApiShape))
  } catch (err) {
    console.error('POST /stories/:id/illustrations/regenerate failed:', err)
    res.status(500).json({ error: 'Failed to regenerate illustration album' })
  }
})

export default router
