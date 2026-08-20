import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'
import { characterReferenceImages } from '../db/schema.js'
import type { CharacterReferenceImage } from '../db/types.js'
import type { ObjectStorage } from '../storage/object-storage.interface.js'
import { buildCharacterAssetPath } from './build-character-asset-path.js'

const EXTENSION_BY_MIMETYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export interface SaveReferenceImageInput {
  characterId: number
  buffer: Buffer
  mimetype: string
}

export async function saveReferenceImage(
  input: SaveReferenceImageInput,
  storage: ObjectStorage,
): Promise<CharacterReferenceImage> {
  const extension = EXTENSION_BY_MIMETYPE[input.mimetype] ?? 'png'
  const fileId = randomUUID()
  const storagePath = buildCharacterAssetPath({ kind: 'reference', characterId: input.characterId, fileId, extension })

  await storage.upload({ path: storagePath, data: input.buffer, contentType: input.mimetype })

  const [row] = await db
    .insert(characterReferenceImages)
    .values({ characterId: input.characterId, storagePath })
    .returning()

  if (!row) {
    throw new Error('Insert of new reference image row returned no row')
  }

  return row
}
