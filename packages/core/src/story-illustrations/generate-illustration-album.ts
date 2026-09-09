import { randomUUID } from 'node:crypto'
import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '../db/client.js'
import { stories, storyIllustrationMarkers, storyIllustrations } from '../db/schema.js'
import type { StoryIllustration } from '../db/types.js'
import { env } from '../env.js'
import { aiRunner } from '../ai/index.js'
import type { ObjectStorage } from '../storage/object-storage.interface.js'
import { buildPublicObjectUrl } from '../character-portraits/build-public-object-url.js'
import { loadDefaultStyleImageDataUri } from '../pipeline/assets/load-default-style-image.js'
import { selectIllustrationMoments } from '../pipeline/stages/select-illustration-moments.js'
import { buildStoryIllustrationAssetPath } from './build-story-illustration-asset-path.js'
import { buildIllustrationPrompt, type BuildIllustrationPromptCharacter } from './build-illustration-prompt.js'
import { matchCharacterNamesToCast } from './match-character-names-to-cast.js'
import { detectCastMembersInText } from './detect-cast-members-in-text.js'
import { loadStoryCast } from './load-story-cast.js'
import type { CharacterWithPortrait } from '../character-portraits/load-characters-with-portrait.js'

export const ILLUSTRATION_MODEL = 'google/gemini-3.1-flash-image'
const TARGET_COUNT = 2
// google/gemini-3.1-flash-image ("Nano Banana 2") accepts up to 14 input_references total
// (confirmed live via GET https://openrouter.ai/api/v1/images/models — the prior model,
// gemini-2.5-flash-image, capped at 3, which forced identity references down to 2). One slot is
// always reserved for the style anchor image below, so identity references are capped at 6.
const MAX_IDENTITY_REFERENCES = 6

export interface GenerateIllustrationAlbumOptions {
  force?: boolean
}

interface InternalMoment {
  kind: 'scene_description' | 'story_excerpt'
  text: string
  source: 'automatic' | 'manual'
  matchedCharacterIds: number[]
}

function mediaTypeToExtension(mediaType: string): string {
  if (mediaType.includes('jpeg')) return 'jpg'
  if (mediaType.includes('webp')) return 'webp'
  return 'png'
}

export async function generateIllustrationAlbum(
  storyId: number,
  storage: ObjectStorage,
  options: GenerateIllustrationAlbumOptions = {},
): Promise<StoryIllustration[]> {
  const force = options.force ?? false

  const [story] = await db.select().from(stories).where(eq(stories.id, storyId))

  if (!story) return []

  const storyText = story.textFinal ?? story.textV2 ?? story.textV1

  if (!storyText) return []

  if (!force) {
    const existingRows = await db
      .select()
      .from(storyIllustrations)
      .where(and(eq(storyIllustrations.storyId, storyId), ne(storyIllustrations.source, 'custom')))
      .orderBy(asc(storyIllustrations.orderIndex))

    if (existingRows.length > 0) return existingRows
  }

  const cast = await loadStoryCast(storyId)
  const castNames = cast.map((c) => ({ id: c.id, name: c.name }))

  const markerRows = await db
    .select()
    .from(storyIllustrationMarkers)
    .where(eq(storyIllustrationMarkers.storyId, storyId))
    .orderBy(asc(storyIllustrationMarkers.id))

  const manualMoments: InternalMoment[] = markerRows.map((marker) => ({
    kind: 'story_excerpt',
    text: marker.markedText,
    source: 'manual',
    matchedCharacterIds: detectCastMembersInText({ text: marker.markedText, cast: castNames }).matchedCharacterIds,
  }))

  const remainingSlots = Math.max(0, TARGET_COUNT - manualMoments.length)

  let automaticMoments: InternalMoment[] = []

  if (remainingSlots > 0) {
    try {
      const selectorResult = await selectIllustrationMoments({
        storyText,
        castNames: castNames.map((c) => c.name),
        count: remainingSlots,
        alreadyMarkedTexts: manualMoments.map((m) => m.text),
        universeId: story.groupId ?? null,
        storyId,
      })

      automaticMoments = selectorResult.moments.map((moment) => ({
        kind: 'scene_description',
        text: moment.scene_description,
        source: 'automatic',
        matchedCharacterIds: matchCharacterNamesToCast({ characterNames: moment.character_names, cast: castNames })
          .matchedCharacterIds,
      }))
    } catch (err) {
      console.error(`[illustration-album] story ${storyId} — automatic moment selection failed:`, err)
      automaticMoments = []
    }
  }

  const combinedMoments = [...manualMoments, ...automaticMoments]

  if (combinedMoments.length === 0) {
    if (force) {
      await db.delete(storyIllustrations).where(and(eq(storyIllustrations.storyId, storyId), ne(storyIllustrations.source, 'custom')))
    }

    return []
  }

  const castById = new Map(cast.map((c) => [c.id, c]))

  const generationInputs = combinedMoments.map((moment, orderIndex) => {
    const matchedCharacters = moment.matchedCharacterIds
      .map((id) => castById.get(id))
      .filter((c): c is CharacterWithPortrait => c !== undefined)

    const identityCandidates = matchedCharacters
      .filter((c) => c.currentPortrait !== null)
      .slice(0, MAX_IDENTITY_REFERENCES)
    const identityIds = new Set(identityCandidates.map((c) => c.id))

    const charactersInMoment: BuildIllustrationPromptCharacter[] = matchedCharacters.map((c) => ({
      name: c.name,
      description: c.description,
      age: c.age,
      traits: c.traits,
      hasIdentityReference: identityIds.has(c.id),
    }))

    const identityUrls = identityCandidates.map((c) =>
      buildPublicObjectUrl({ bucketName: env.GCS_BUCKET_NAME, storagePath: c.currentPortrait!.storagePath }),
    )

    const prompt = buildIllustrationPrompt(
      { kind: moment.kind, text: moment.text },
      charactersInMoment,
      identityCandidates.length,
    )

    return {
      moment,
      orderIndex,
      prompt,
      identityUrls,
      characterIds: matchedCharacters.map((c) => c.id),
    }
  })

  const styleImageDataUri = await loadDefaultStyleImageDataUri()

  const settled = await Promise.allSettled(
    generationInputs.map((input) =>
      aiRunner.generateImage({
        model: ILLUSTRATION_MODEL,
        prompt: input.prompt,
        referenceImageUrls: [...input.identityUrls, styleImageDataUri],
        storyId,
        stage: 'story_illustration',
      }),
    ),
  )

  interface UploadedIllustration {
    storagePath: string
    momentDescription: string
    source: 'automatic' | 'manual'
    characterIds: number[]
    orderIndex: number
  }

  const uploaded: UploadedIllustration[] = []

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!
    const input = generationInputs[i]!

    if (result.status !== 'fulfilled') {
      console.error(`[illustration-album] story ${storyId} — image generation failed for moment ${i}:`, result.reason)
      continue
    }

    try {
      const extension = mediaTypeToExtension(result.value.mediaType)
      const fileId = randomUUID()
      const storagePath = buildStoryIllustrationAssetPath({ storyId, fileId, extension })

      await storage.upload({
        path: storagePath,
        data: Buffer.from(result.value.imageBase64, 'base64'),
        contentType: result.value.mediaType,
      })

      uploaded.push({
        storagePath,
        momentDescription: input.moment.text,
        source: input.moment.source,
        characterIds: input.characterIds,
        orderIndex: input.orderIndex,
      })
    } catch (err) {
      console.error(`[illustration-album] story ${storyId} — upload failed for moment ${i}:`, err)
    }
  }

  if (force) {
    await db.delete(storyIllustrations).where(and(eq(storyIllustrations.storyId, storyId), ne(storyIllustrations.source, 'custom')))
  }

  if (uploaded.length === 0) return []

  const insertedRows = await db
    .insert(storyIllustrations)
    .values(
      uploaded.map((u) => ({
        storyId,
        storagePath: u.storagePath,
        momentDescription: u.momentDescription,
        source: u.source,
        characterIds: u.characterIds,
        orderIndex: u.orderIndex,
      })),
    )
    .returning()

  return insertedRows
}
