import { Router } from 'express'
import multer, { MulterError } from 'multer'
import { and, eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { characterReferenceImages } from '@bedtime/core/db/schema'
import { validateReferenceUpload } from '@bedtime/core/character-portraits/validate-reference-upload'
import { saveReferenceImage } from '@bedtime/core/character-portraits/save-reference-image'
import { objectStorage } from '../storage/gcs-object-storage'

const router = Router()

const SIGNED_URL_TTL_SECONDS = 3600
const MULTER_SAFETY_FILE_SIZE_BYTES = 20 * 1024 * 1024
const MULTER_SAFETY_FILE_COUNT = 10

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MULTER_SAFETY_FILE_SIZE_BYTES, files: MULTER_SAFETY_FILE_COUNT },
})

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

async function toPublicReferenceImage(row: typeof characterReferenceImages.$inferSelect) {
  return {
    id: row.id,
    characterId: row.characterId,
    url: await objectStorage.getSignedReadUrl(row.storagePath, SIGNED_URL_TTL_SECONDS),
    uploadedAt: row.uploadedAt,
  }
}

router.post('/:id/characters/:charId/reference-images', (req, res) => {
  upload.array('files', MULTER_SAFETY_FILE_COUNT)(req, res, async (err: unknown) => {
    if (err) {
      if (err instanceof MulterError) {
        res.status(400).json({ error: `Upload rejected: ${err.message}` })
        return
      }

      console.error('POST reference-images multer failure:', err)
      res.status(500).json({ error: 'Failed to upload reference images' })
      return
    }

    try {
      const charId = parseIntParam(req.params['charId'])

      if (isNaN(charId)) {
        res.status(400).json({ error: 'Invalid id' })
        return
      }

      const files = (req.files as Express.Multer.File[] | undefined) ?? []

      if (files.length === 0) {
        res.status(400).json({ error: 'No files provided' })
        return
      }

      for (const file of files) {
        const validation = validateReferenceUpload({ mimetype: file.mimetype, sizeBytes: file.size }, files.length)

        if (!validation.ok) {
          res.status(400).json({ error: validation.reason })
          return
        }
      }

      const saved = await Promise.all(
        files.map((file) => saveReferenceImage({ characterId: charId, buffer: file.buffer, mimetype: file.mimetype }, objectStorage)),
      )

      const withUrls = await Promise.all(saved.map(toPublicReferenceImage))

      res.status(201).json(withUrls)
    } catch (err) {
      console.error('POST /universes/:id/characters/:charId/reference-images failed:', err)
      res.status(500).json({ error: 'Failed to upload reference images' })
    }
  })
})

router.get('/:id/characters/:charId/reference-images', async (req, res) => {
  try {
    const charId = parseIntParam(req.params['charId'])

    if (isNaN(charId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const rows = await db.select().from(characterReferenceImages).where(eq(characterReferenceImages.characterId, charId))
    const withUrls = await Promise.all(rows.map(toPublicReferenceImage))

    res.json(withUrls)
  } catch (err) {
    console.error('GET /universes/:id/characters/:charId/reference-images failed:', err)
    res.status(500).json({ error: 'Failed to fetch reference images' })
  }
})

router.delete('/:id/characters/:charId/reference-images/:imageId', async (req, res) => {
  try {
    const charId = parseIntParam(req.params['charId'])
    const imageId = parseIntParam(req.params['imageId'])

    if (isNaN(charId) || isNaN(imageId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const [existing] = await db
      .select({ id: characterReferenceImages.id })
      .from(characterReferenceImages)
      .where(and(eq(characterReferenceImages.id, imageId), eq(characterReferenceImages.characterId, charId)))

    if (!existing) {
      res.status(404).json({ error: 'Reference image not found' })
      return
    }

    await db.delete(characterReferenceImages).where(eq(characterReferenceImages.id, imageId))

    res.status(204).send()
  } catch (err) {
    console.error('DELETE /universes/:id/characters/:charId/reference-images/:imageId failed:', err)
    res.status(500).json({ error: 'Failed to delete reference image' })
  }
})

export default router
