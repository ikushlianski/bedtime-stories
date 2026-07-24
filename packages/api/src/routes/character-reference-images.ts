import { randomUUID } from 'node:crypto'
import { Router, Request } from 'express'
import multer from 'multer'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { characterReferenceImages, universeCharacters } from '@bedtime/core/db/schema'
import { uploadImage, readImage, deleteImage } from '@bedtime/core/storage/gcs-images'
import { deriveCharacterReferenceImagePath } from '@bedtime/core/pipeline/derivers/character-reference-image-path'
import { deriveContentTypeExtension } from '@bedtime/core/pipeline/derivers/content-type-extension'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, callback) => {
    if (deriveContentTypeExtension(file.mimetype) === null) {
      callback(new Error('Unsupported content type'))
      return
    }

    callback(null, true)
  },
})

type CharacterParams = { universeId: string; charId: string }
type ReferenceImageParams = CharacterParams & { refId: string }

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

async function findCharacter(universeId: number, charId: number) {
  const [character] = await db
    .select()
    .from(universeCharacters)
    .where(and(eq(universeCharacters.id, charId), eq(universeCharacters.universeId, universeId)))

  return character ?? null
}

const router = Router({ mergeParams: true })

router.post('/', (req: Request<CharacterParams>, res) => {
  upload.single('file')(req, res, async (err: unknown) => {
    try {
      if (err) {
        const message = err instanceof Error ? err.message : 'Invalid upload'
        res.status(400).json({ error: message })
        return
      }

      const universeId = parseIntParam(req.params['universeId'])
      const charId = parseIntParam(req.params['charId'])

      if (isNaN(universeId) || isNaN(charId)) {
        res.status(400).json({ error: 'Invalid id' })
        return
      }

      const file = req.file

      if (!file) {
        res.status(400).json({ error: 'No file uploaded' })
        return
      }

      const extension = deriveContentTypeExtension(file.mimetype)

      if (extension === null) {
        res.status(400).json({ error: 'Unsupported content type' })
        return
      }

      const character = await findCharacter(universeId, charId)

      if (!character) {
        res.status(404).json({ error: 'Character not found' })
        return
      }

      const gcsPath = deriveCharacterReferenceImagePath({
        universeId,
        characterId: charId,
        uuid: randomUUID(),
        extension,
      })

      await uploadImage(gcsPath, file.buffer, file.mimetype)

      const [created] = await db
        .insert(characterReferenceImages)
        .values({ characterId: charId, gcsPath })
        .returning()

      res.status(201).json(created)
    } catch (uploadErr) {
      console.error('POST /universes/:universeId/characters/:charId/reference-images failed:', uploadErr)
      res.status(500).json({ error: 'Failed to upload reference image' })
    }
  })
})

router.get('/', async (req: Request<CharacterParams>, res) => {
  try {
    const universeId = parseIntParam(req.params['universeId'])
    const charId = parseIntParam(req.params['charId'])

    if (isNaN(universeId) || isNaN(charId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const character = await findCharacter(universeId, charId)

    if (!character) {
      res.status(404).json({ error: 'Character not found' })
      return
    }

    const rows = await db
      .select()
      .from(characterReferenceImages)
      .where(eq(characterReferenceImages.characterId, charId))
      .orderBy(desc(characterReferenceImages.uploadedAt))

    res.json(rows)
  } catch (err) {
    console.error('GET /universes/:universeId/characters/:charId/reference-images failed:', err)
    res.status(500).json({ error: 'Failed to fetch reference images' })
  }
})

router.get('/:refId', async (req: Request<ReferenceImageParams>, res) => {
  try {
    const universeId = parseIntParam(req.params['universeId'])
    const charId = parseIntParam(req.params['charId'])
    const refId = parseIntParam(req.params['refId'])

    if (isNaN(universeId) || isNaN(charId) || isNaN(refId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const [row] = await db
      .select()
      .from(characterReferenceImages)
      .where(and(eq(characterReferenceImages.id, refId), eq(characterReferenceImages.characterId, charId)))

    if (!row) {
      res.status(404).json({ error: 'Reference image not found' })
      return
    }

    const image = await readImage(row.gcsPath)

    if (!image) {
      res.status(404).json({ error: 'Reference image not found' })
      return
    }

    res.setHeader('Content-Type', image.contentType)
    res.setHeader('Cache-Control', 'private, max-age=86400')
    res.send(image.bytes)
  } catch (err) {
    console.error('GET /universes/:universeId/characters/:charId/reference-images/:refId failed:', err)
    res.status(500).json({ error: 'Failed to fetch reference image' })
  }
})

router.delete('/:refId', async (req: Request<ReferenceImageParams>, res) => {
  try {
    const universeId = parseIntParam(req.params['universeId'])
    const charId = parseIntParam(req.params['charId'])
    const refId = parseIntParam(req.params['refId'])

    if (isNaN(universeId) || isNaN(charId) || isNaN(refId)) {
      res.status(400).json({ error: 'Invalid id' })
      return
    }

    const [row] = await db
      .select()
      .from(characterReferenceImages)
      .where(and(eq(characterReferenceImages.id, refId), eq(characterReferenceImages.characterId, charId)))

    if (!row) {
      res.status(404).json({ error: 'Reference image not found' })
      return
    }

    await deleteImage(row.gcsPath)
    await db.delete(characterReferenceImages).where(eq(characterReferenceImages.id, refId))

    res.status(204).send()
  } catch (err) {
    console.error('DELETE /universes/:universeId/characters/:charId/reference-images/:refId failed:', err)
    res.status(500).json({ error: 'Failed to delete reference image' })
  }
})

export default router
