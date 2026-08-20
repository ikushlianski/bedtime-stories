import { Router } from 'express'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { characterPortraits } from '@bedtime/core/db/schema'
import { env } from '@bedtime/core/env'
import { buildPublicObjectUrl } from '@bedtime/core/character-portraits/build-public-object-url'
import {
  generatePortrait,
  CharacterNotFoundError,
  PortraitGenerationError,
  PortraitSaveError,
} from '@bedtime/core/character-portraits/generate-portrait'
import { ModelNotInCatalogError } from '@bedtime/core/openrouter/openrouter.runner'
import { objectStorage } from '../storage/gcs-object-storage'

const router = Router()
const MAX_PREVIOUS_PORTRAITS = 3

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

router.post('/:id/characters/:charId/portrait', async (req, res) => {
  try {
    const charId = parseIntParam(req.params['charId'])

    if (isNaN(charId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const result = await generatePortrait({ characterId: charId }, objectStorage)

    res.status(201).json({
      imageUrl: result.imageUrl,
      tier: result.tier,
      generatedAt: result.generatedAt,
    })
  } catch (err) {
    if (err instanceof CharacterNotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }

    if (err instanceof ModelNotInCatalogError) {
      res.status(503).json({ error: err.message })
      return
    }

    if (err instanceof PortraitSaveError) {
      console.error('POST portrait: generated and billed, but save failed:', err.cause)
      res.status(500).json({
        error: 'The portrait was generated and you were charged for it, but saving it failed. Please try again — you will not be billed twice for a save failure.',
        billed: true,
      })
      return
    }

    if (err instanceof PortraitGenerationError) {
      res.status(502).json({ error: err.message, billed: false })
      return
    }

    console.error('POST /universes/:id/characters/:charId/portrait failed:', err)
    res.status(500).json({ error: 'Failed to generate portrait' })
  }
})

router.get('/:id/characters/:charId/portrait-history', async (req, res) => {
  try {
    const charId = parseIntParam(req.params['charId'])

    if (isNaN(charId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const rows = await db
      .select()
      .from(characterPortraits)
      .where(and(eq(characterPortraits.characterId, charId), eq(characterPortraits.isCurrent, false)))
      .orderBy(desc(characterPortraits.generatedAt))
      .limit(MAX_PREVIOUS_PORTRAITS)

    res.json(
      rows.map((row) => ({
        id: row.id,
        imageUrl: buildPublicObjectUrl({ bucketName: env.GCS_BUCKET_NAME, storagePath: row.storagePath }),
        tier: row.tier,
        generatedAt: row.generatedAt,
      })),
    )
  } catch (err) {
    console.error('GET /universes/:id/characters/:charId/portrait-history failed:', err)
    res.status(500).json({ error: 'Failed to fetch portrait history' })
  }
})

export default router
