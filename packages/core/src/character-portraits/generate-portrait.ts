import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, desc, eq, ne } from 'drizzle-orm'
import { db } from '../db/client.js'
import { characterPortraits, universeCharacters } from '../db/schema.js'
import { env } from '../env.js'
import { aiRunner } from '../ai/index.js'
import { ModelNotInCatalogError } from '../openrouter/openrouter.runner.js'
import type { ObjectStorage } from '../storage/object-storage.interface.js'
import { deriveReferenceTier, type PortraitTier } from './derive-reference-tier.js'
import { buildPortraitPrompt } from './build-portrait-prompt.js'
import { buildCharacterAssetPath } from './build-character-asset-path.js'
import { buildPublicObjectUrl } from './build-public-object-url.js'
import { loadPortraitCandidates } from './load-portrait-candidates.js'

export const PORTRAIT_MODEL = 'google/gemini-2.5-flash-image'
const SIGNED_REFERENCE_URL_TTL_SECONDS = 600
const MAX_PREVIOUS_PORTRAITS = 3
const DEFAULT_STYLE_REFERENCE_PATH = join(
  import.meta.dirname,
  '../pipeline/assets/default-character-style-reference.png',
)

export class PortraitGenerationError extends Error {}

export class PortraitSaveError extends Error {
  constructor(
    message: string,
    readonly cause: unknown,
  ) {
    super(message)
  }
}

export class CharacterNotFoundError extends Error {
  constructor(characterId: number) {
    super(`Character ${characterId} not found`)
  }
}

export interface GeneratePortraitInput {
  characterId: number
}

export interface GeneratePortraitResult {
  storagePath: string
  imageUrl: string
  tier: PortraitTier
  generatedAt: Date | null
}

function mediaTypeToExtension(mediaType: string): string {
  if (mediaType.includes('jpeg')) return 'jpg'
  if (mediaType.includes('webp')) return 'webp'
  return 'png'
}

async function resolveReferenceImageUrls(
  tier: PortraitTier,
  referenceValues: string[],
  storage: ObjectStorage,
): Promise<string[]> {
  if (tier === 'own_reference') {
    return Promise.all(referenceValues.map((path) => storage.getSignedReadUrl(path, SIGNED_REFERENCE_URL_TTL_SECONDS)))
  }

  if (tier === 'universe_sibling') {
    return referenceValues.map((path) => buildPublicObjectUrl({ bucketName: env.GCS_BUCKET_NAME, storagePath: path }))
  }

  const defaultImageBuffer = await readFile(DEFAULT_STYLE_REFERENCE_PATH)
  return [`data:image/png;base64,${defaultImageBuffer.toString('base64')}`]
}

async function prunePreviousPortraits(characterId: number): Promise<void> {
  const previousRows = await db
    .select()
    .from(characterPortraits)
    .where(and(eq(characterPortraits.characterId, characterId), eq(characterPortraits.isCurrent, false)))
    .orderBy(desc(characterPortraits.generatedAt))

  const toDelete = previousRows.slice(MAX_PREVIOUS_PORTRAITS)

  for (const row of toDelete) {
    await db.delete(characterPortraits).where(eq(characterPortraits.id, row.id))
  }
}

export async function generatePortrait(
  input: GeneratePortraitInput,
  storage: ObjectStorage,
): Promise<GeneratePortraitResult> {
  const [character] = await db.select().from(universeCharacters).where(eq(universeCharacters.id, input.characterId))

  if (!character) {
    throw new CharacterNotFoundError(input.characterId)
  }

  const candidates = await loadPortraitCandidates({ characterId: character.id, universeId: character.universeId })
  const { tier, referenceValues } = deriveReferenceTier(candidates)

  const prompt = buildPortraitPrompt(
    { name: character.name, description: character.description, age: character.age, traits: character.traits },
    tier,
  )

  const referenceImageUrls = await resolveReferenceImageUrls(tier, referenceValues, storage)

  let generated: { imageBase64: string; mediaType: string }

  try {
    generated = await aiRunner.generateImage({
      model: PORTRAIT_MODEL,
      prompt,
      referenceImageUrls,
      characterId: character.id,
      stage: 'character_portrait',
    })
  } catch (err) {
    if (err instanceof ModelNotInCatalogError) throw err

    throw new PortraitGenerationError(err instanceof Error ? err.message : 'Portrait generation failed')
  }

  try {
    const extension = mediaTypeToExtension(generated.mediaType)
    const fileId = randomUUID()
    const storagePath = buildCharacterAssetPath({ kind: 'portrait', characterId: character.id, fileId, extension })

    await storage.upload({
      path: storagePath,
      data: Buffer.from(generated.imageBase64, 'base64'),
      contentType: generated.mediaType,
    })

    const [newRow] = await db
      .insert(characterPortraits)
      .values({
        characterId: character.id,
        storagePath,
        tier,
        sourceStoragePaths: tier === 'default_style' ? null : referenceValues,
        isCurrent: true,
      })
      .returning()

    if (!newRow) {
      throw new Error('Insert of new portrait row returned no row')
    }

    await db
      .update(characterPortraits)
      .set({ isCurrent: false })
      .where(
        and(
          eq(characterPortraits.characterId, character.id),
          eq(characterPortraits.isCurrent, true),
          ne(characterPortraits.id, newRow.id),
        ),
      )

    await prunePreviousPortraits(character.id)

    return {
      storagePath: newRow.storagePath,
      imageUrl: buildPublicObjectUrl({ bucketName: env.GCS_BUCKET_NAME, storagePath: newRow.storagePath }),
      tier,
      generatedAt: newRow.generatedAt,
    }
  } catch (err) {
    throw new PortraitSaveError('Portrait was generated and billed, but saving it failed', err)
  }
}
