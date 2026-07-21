import { Router, Request } from 'express'
import { and, eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, storyGroups, storyImages, universeCharacters } from '@bedtime/core/db/schema'
import { OpenRouterClient, ImageModerationRefusedError } from '@bedtime/core/openrouter/openrouter.client'
import { isRetryable } from '@bedtime/core/openrouter/openrouter.runner'
import { costRecorder } from '@bedtime/core/cost/cost-recorder'
import { env } from '@bedtime/core/env'
import { uploadImage, readImage, isGcsConfigured } from '@bedtime/core/storage/gcs-images'
import { selectIllustrationMoments } from '@bedtime/core/pipeline/stages/illustration-moment-selector'
import { deriveIllustrationPrompt } from '@bedtime/core/pipeline/derivers/illustration-prompt'
import { deriveImageStoragePath } from '@bedtime/core/pipeline/derivers/image-storage-path'
import { deriveImageRetryDecision, type ImageGenerationOutcome } from '@bedtime/core/pipeline/derivers/image-retry-decision'
import { deriveReferenceImageUpdate } from '@bedtime/core/pipeline/derivers/reference-image-update'

const IMAGE_MODEL = 'google/gemini-2.5-flash-image'
const STAGE = 'illustration_image'

type StoryParams = { id: string }

function parseIntParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
  return parseInt(value, 10)
}

function classifyOutcome(err: unknown): ImageGenerationOutcome {
  if (err instanceof ImageModerationRefusedError) return 'moderation_refused'
  if (isRetryable(err)) return 'retryable'
  return 'terminal_error'
}

async function generateSingleImage(params: {
  storyId: number
  universeId: number | null
  sequenceIndex: number
  sceneDescription: string
  prompt: string
  gcsPath: string
  referenceImagePath: string | null
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
  const referenceImageUsed = params.referenceImagePath !== null
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
      set: { status: 'generating', promptUsed: params.prompt, sceneDescription: params.sceneDescription, updatedAt: new Date() },
    })

  for (;;) {
    attempt += 1
    const startedAt = Date.now()
    let isStorageError = false

    try {
      let referenceImageFields: { referenceImageBase64: string; referenceImageMediaType: string } | null = null

      if (params.referenceImagePath && isGcsConfigured()) {
        const referenceImage = await readImage(params.referenceImagePath)

        if (referenceImage) {
          referenceImageFields = {
            referenceImageBase64: referenceImage.bytes.toString('base64'),
            referenceImageMediaType: referenceImage.contentType,
          }
        }
      }

      const result = await client.generateImage({
        model: IMAGE_MODEL,
        prompt: params.prompt,
        ...(referenceImageFields ?? {}),
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
  let referenceImagePath: string | null = null
  let characters: Array<{ name: string; visualDescription: string | null }> = []

  if (universeId !== null) {
    const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, universeId))

    visualStyleGuide = group?.visualStyleGuide ?? null
    referenceImagePath = group?.referenceImagePath ?? null

    characters = await db
      .select({ name: universeCharacters.name, visualDescription: universeCharacters.visualDescription })
      .from(universeCharacters)
      .where(eq(universeCharacters.universeId, universeId))
  }

  console.log(`[story-images] story=${storyId} selecting illustration moments`)

  const moments = await selectIllustrationMoments({ storyText })

  console.log(`[story-images] story=${storyId} selected ${moments.scenes.length} scene(s)`)

  let referenceSetThisRun = false

  for (let sequenceIndex = 0; sequenceIndex < moments.scenes.length; sequenceIndex++) {
    const scene = moments.scenes[sequenceIndex]!
    const scenedCharacters = characters.filter((c) => scene.characters_present.includes(c.name))
    const prompt = deriveIllustrationPrompt({
      sceneDescription: scene.image_prompt,
      visualStyleGuide,
      characters: scenedCharacters,
    })
    const gcsPath = deriveImageStoragePath({ universeId, storyId, sequenceIndex })

    const outcome = await generateSingleImage({
      storyId,
      universeId,
      sequenceIndex,
      sceneDescription: scene.scene_description,
      prompt,
      gcsPath,
      referenceImagePath,
    })

    if (outcome.success && universeId !== null && !referenceSetThisRun) {
      const decision = deriveReferenceImageUpdate({
        currentReferenceImagePath: referenceImagePath,
        newSuccessPath: gcsPath,
      })

      if (decision.shouldUpdate) {
        await db.update(storyGroups).set({ referenceImagePath: decision.newPath }).where(eq(storyGroups.id, universeId))
        referenceSetThisRun = true
        console.log(`[story-images] universe=${universeId} reference image set to ${decision.newPath}`)
      }
    }
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
