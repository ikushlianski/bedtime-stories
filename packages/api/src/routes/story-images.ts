import { Router, Request } from 'express'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, storyGroups, storyImages, universeCharacters, characterReferenceImages } from '@bedtime/core/db/schema'
import { OpenRouterClient, ImageModerationRefusedError, type ImageGenerationReference } from '@bedtime/core/openrouter/openrouter.client'
import { isRetryable } from '@bedtime/core/openrouter/openrouter.runner'
import { costRecorder } from '@bedtime/core/cost/cost-recorder'
import { env } from '@bedtime/core/env'
import { uploadImage, readImage, isGcsConfigured } from '@bedtime/core/storage/gcs-images'
import { selectIllustrationMoments } from '@bedtime/core/pipeline/stages/illustration-moment-selector'
import { deriveIllustrationPrompt } from '@bedtime/core/pipeline/derivers/illustration-prompt'
import { deriveImageStoragePath } from '@bedtime/core/pipeline/derivers/image-storage-path'
import { deriveImageRetryDecision, type ImageGenerationOutcome } from '@bedtime/core/pipeline/derivers/image-retry-decision'
import { deriveReferenceImageGate } from '@bedtime/core/pipeline/derivers/reference-image-gate'
import { charactersMatch } from '@bedtime/core/pipeline/derivers/character-name-match'

const IMAGE_MODEL = 'google/gemini-2.5-flash-image'
const STAGE = 'illustration_image'

type StoryParams = { id: string }

interface UniverseCharacterInfo {
  id: number
  name: string
  visualDescription: string | null
}

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

function classifyOutcome(err: unknown): ImageGenerationOutcome {
  if (err instanceof ImageModerationRefusedError) return 'moderation_refused'
  if (isRetryable(err)) return 'retryable'
  return 'terminal_error'
}

async function loadLatestReferenceImagePathByCharacterId(characterIds: number[]): Promise<Map<number, string>> {
  if (characterIds.length === 0) return new Map()

  const rows = await db
    .select({ characterId: characterReferenceImages.characterId, gcsPath: characterReferenceImages.gcsPath })
    .from(characterReferenceImages)
    .where(inArray(characterReferenceImages.characterId, characterIds))
    .orderBy(desc(characterReferenceImages.uploadedAt))

  const latestPathByCharacterId = new Map<number, string>()

  for (const row of rows) {
    if (!latestPathByCharacterId.has(row.characterId)) {
      latestPathByCharacterId.set(row.characterId, row.gcsPath)
    }
  }

  return latestPathByCharacterId
}

async function loadReferenceImagesForScene(
  charactersPresent: string[],
  characters: UniverseCharacterInfo[],
  latestPathByCharacterId: Map<number, string>,
): Promise<ImageGenerationReference[]> {
  const paths = charactersPresent
    .map((name) => characters.find((c) => charactersMatch(c.name, name)))
    .filter((c): c is UniverseCharacterInfo => c !== undefined)
    .map((c) => latestPathByCharacterId.get(c.id))
    .filter((path): path is string => path !== undefined)

  const images = await Promise.all(paths.map((path) => readImage(path)))

  return images
    .filter((image): image is NonNullable<typeof image> => image !== null)
    .map((image) => ({ base64: image.bytes.toString('base64'), mediaType: image.contentType }))
}

async function writeGateFailureRow(params: {
  storyId: number
  universeId: number | null
  sequenceIndex: number
  sceneDescription: string
  prompt: string
  missingCharacterNames: string[]
}): Promise<void> {
  const failureReason = `no reference image for character: ${params.missingCharacterNames.join(', ')}`

  await db
    .insert(storyImages)
    .values({
      storyId: params.storyId,
      universeId: params.universeId,
      sequenceIndex: params.sequenceIndex,
      sceneDescription: params.sceneDescription,
      promptUsed: params.prompt,
      status: 'failed',
      failureReason,
      referenceImageUsed: false,
      attempt: 1,
    })
    .onConflictDoUpdate({
      target: [storyImages.storyId, storyImages.sequenceIndex],
      set: {
        status: 'failed',
        failureReason,
        promptUsed: params.prompt,
        sceneDescription: params.sceneDescription,
        referenceImageUsed: false,
        updatedAt: new Date(),
      },
    })

  console.warn(`[story-images] story=${params.storyId} scene=${params.sequenceIndex} gated: ${failureReason}`)
}

async function generateSingleImage(params: {
  storyId: number
  universeId: number | null
  sequenceIndex: number
  sceneDescription: string
  prompt: string
  gcsPath: string
  referenceImages: ImageGenerationReference[]
}): Promise<{ success: boolean }> {
  const existingRows = await db
    .select()
    .from(storyImages)
    .where(and(eq(storyImages.storyId, params.storyId), eq(storyImages.sequenceIndex, params.sequenceIndex)))

  const existing = existingRows[0]

  if (existing?.status === 'ready') {
    return { success: true }
  }

  const client = new OpenRouterClient(env.OPENROUTER_API_KEY)
  const referenceImageUsed = params.referenceImages.length > 0
  let attempt = existing?.attempt ?? 0

  await db
    .insert(storyImages)
    .values({
      storyId: params.storyId,
      universeId: params.universeId,
      sequenceIndex: params.sequenceIndex,
      sceneDescription: params.sceneDescription,
      promptUsed: params.prompt,
      status: 'generating',
      referenceImageUsed,
      attempt: attempt + 1,
    })
    .onConflictDoUpdate({
      target: [storyImages.storyId, storyImages.sequenceIndex],
      set: { status: 'generating', promptUsed: params.prompt, sceneDescription: params.sceneDescription, referenceImageUsed, updatedAt: new Date() },
    })

  for (;;) {
    attempt += 1
    const startedAt = Date.now()
    let isStorageError = false

    try {
      const result = await client.generateImage({
        model: IMAGE_MODEL,
        prompt: params.prompt,
        referenceImages: params.referenceImages,
      })

      const latencyMs = Date.now() - startedAt

      await costRecorder.record({
        storyId: params.storyId,
        stage: STAGE,
        modelId: IMAGE_MODEL,
        attempt,
        fallbackUsed: false,
        tokensIn: result.usage.promptTokens,
        tokensOut: result.usage.completionTokens,
        usd: result.usage.costUsd,
        latencyMs,
        success: true,
      })

      try {
        await uploadImage(params.gcsPath, Buffer.from(result.imageBase64, 'base64'), result.mediaType)
      } catch (uploadErr) {
        isStorageError = true
        throw uploadErr
      }

      const decision = deriveImageRetryDecision({ attempt, outcome: 'success' })

      await db
        .update(storyImages)
        .set({
          status: decision.nextStatus,
          modelId: IMAGE_MODEL,
          gcsPath: params.gcsPath,
          failureReason: decision.failureReason,
          attempt,
          referenceImageUsed,
          updatedAt: new Date(),
        })
        .where(and(eq(storyImages.storyId, params.storyId), eq(storyImages.sequenceIndex, params.sequenceIndex)))

      console.log(`[story-images] story=${params.storyId} scene=${params.sequenceIndex} ready gcsPath=${params.gcsPath}`)

      return { success: true }
    } catch (err) {
      const latencyMs = Date.now() - startedAt

      if (!isStorageError) {
        await costRecorder.record({
          storyId: params.storyId,
          stage: STAGE,
          modelId: IMAGE_MODEL,
          attempt,
          fallbackUsed: false,
          tokensIn: 0,
          tokensOut: 0,
          usd: 0,
          latencyMs,
          success: false,
        })
      }

      const outcome: ImageGenerationOutcome = isStorageError ? 'retryable' : classifyOutcome(err)
      const decision = deriveImageRetryDecision({ attempt, outcome })
      const failureReason = isStorageError && !decision.shouldRetry ? 'storage_error' : decision.failureReason

      await db
        .update(storyImages)
        .set({ status: decision.nextStatus, failureReason, attempt, updatedAt: new Date() })
        .where(and(eq(storyImages.storyId, params.storyId), eq(storyImages.sequenceIndex, params.sequenceIndex)))

      if (decision.shouldRetry) {
        console.warn(`[story-images] story=${params.storyId} scene=${params.sequenceIndex} attempt=${attempt} retrying:`, err)
        continue
      }

      console.error(`[story-images] story=${params.storyId} scene=${params.sequenceIndex} failed reason=${failureReason}:`, err)

      return { success: false }
    }
  }
}

export async function generateStoryImages(storyId: number): Promise<void> {
  if (!isGcsConfigured()) {
    console.warn(`[story-images] GCS_BUCKET_NAME is not configured, skipping illustration generation for story=${storyId}`)
    return
  }

  const [story] = await db.select().from(stories).where(eq(stories.id, storyId))

  if (!story) {
    throw new Error(`Story ${storyId} not found`)
  }

  const storyText = story.textFinal ?? story.textV2 ?? story.textV1

  if (!storyText) {
    throw new Error(`Story ${storyId} has no text to illustrate`)
  }

  const universeId = story.groupId ?? null
  let visualStyleGuide: string | null = null
  let characters: UniverseCharacterInfo[] = []

  if (universeId !== null) {
    const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, universeId))

    visualStyleGuide = group?.visualStyleGuide ?? null

    characters = await db
      .select({ id: universeCharacters.id, name: universeCharacters.name, visualDescription: universeCharacters.visualDescription })
      .from(universeCharacters)
      .where(eq(universeCharacters.universeId, universeId))
  }

  const latestPathByCharacterId = await loadLatestReferenceImagePathByCharacterId(characters.map((c) => c.id))
  const referenceableCharacterNames = characters.filter((c) => latestPathByCharacterId.has(c.id)).map((c) => c.name)

  console.log(`[story-images] story=${storyId} selecting illustration moments`)

  const moments = await selectIllustrationMoments({ storyText, characterNames: characters.map((c) => c.name) })

  console.log(`[story-images] story=${storyId} selected ${moments.scenes.length} scene(s)`)

  for (let sequenceIndex = 0; sequenceIndex < moments.scenes.length; sequenceIndex++) {
    const scene = moments.scenes[sequenceIndex]!

    const existingRows = await db
      .select()
      .from(storyImages)
      .where(and(eq(storyImages.storyId, storyId), eq(storyImages.sequenceIndex, sequenceIndex)))

    if (existingRows[0]?.status === 'ready') {
      continue
    }

    const scenedCharacters = characters.filter((c) => scene.characters_present.some((name) => charactersMatch(c.name, name)))
    const prompt = deriveIllustrationPrompt({
      sceneDescription: scene.image_prompt,
      visualStyleGuide,
      characters: scenedCharacters,
    })
    const gcsPath = deriveImageStoragePath({ universeId, storyId, sequenceIndex })

    const gate = deriveReferenceImageGate({
      charactersPresent: scene.characters_present,
      referenceableCharacterNames,
    })

    if (!gate.ok) {
      await writeGateFailureRow({
        storyId,
        universeId,
        sequenceIndex,
        sceneDescription: scene.scene_description,
        prompt,
        missingCharacterNames: gate.missingCharacterNames,
      })
      continue
    }

    const referenceImages = await loadReferenceImagesForScene(scene.characters_present, characters, latestPathByCharacterId)

    await generateSingleImage({
      storyId,
      universeId,
      sequenceIndex,
      sceneDescription: scene.scene_description,
      prompt,
      gcsPath,
      referenceImages,
    })
  }

  console.log(`[story-images] story=${storyId} — done`)
}

const router = Router({ mergeParams: true })

router.get('/', async (req: Request<StoryParams>, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const rows = await db
      .select({ sequenceIndex: storyImages.sequenceIndex, status: storyImages.status })
      .from(storyImages)
      .where(and(eq(storyImages.storyId, storyId), eq(storyImages.status, 'ready')))

    res.json(
      rows
        .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
        .map((row) => ({
          sequenceIndex: row.sequenceIndex,
          url: `/api/stories/${storyId}/images/${row.sequenceIndex}`,
        })),
    )
  } catch (err) {
    console.error('GET /stories/:id/images failed:', err)
    res.status(500).json({ error: 'Failed to list story images' })
  }
})

router.get('/:sequenceIndex', async (req: Request<StoryParams & { sequenceIndex: string }>, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])
    const sequenceIndex = parseIntParam(req.params['sequenceIndex'])

    if (isNaN(storyId) || isNaN(sequenceIndex)) {
      res.status(400).json({ error: 'Invalid story id or sequence index' })
      return
    }

    const [row] = await db
      .select()
      .from(storyImages)
      .where(and(eq(storyImages.storyId, storyId), eq(storyImages.sequenceIndex, sequenceIndex)))

    if (!row || row.status !== 'ready' || !row.gcsPath) {
      res.status(404).json({ error: 'Image not found' })
      return
    }

    const image = await readImage(row.gcsPath)

    if (!image) {
      res.status(404).json({ error: 'Image not found' })
      return
    }

    res.setHeader('Content-Type', image.contentType)
    res.setHeader('Cache-Control', 'private, max-age=86400')
    res.send(image.bytes)
  } catch (err) {
    console.error('GET /stories/:id/images/:sequenceIndex failed:', err)
    res.status(500).json({ error: 'Failed to fetch story image' })
  }
})

export default router
