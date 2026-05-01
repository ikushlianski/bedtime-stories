import { Router, type Request } from 'express'
import { eq, asc, and, sql } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, storyTextVersions } from '@bedtime/core/db/schema'

interface StoryParams { id: string }
interface VersionParams { id: string; versionId: string }

const router = Router({ mergeParams: true })

function parseId(raw: string | undefined): number {
  return parseInt(raw ?? '', 10)
}

router.get('/', async (req: Request<StoryParams>, res) => {
  const storyId = parseId(req.params.id)

  if (isNaN(storyId)) {
    res.status(400).json({ error: 'Invalid story id' })
    return
  }

  try {
    const versions = await db
      .select({
        id: storyTextVersions.id,
        version_number: storyTextVersions.versionNumber,
        model_id: storyTextVersions.modelId,
        stage: storyTextVersions.stage,
        created_at: storyTextVersions.createdAt,
        preview: sql<string>`substring(${storyTextVersions.text}, 1, 200)`,
      })
      .from(storyTextVersions)
      .where(eq(storyTextVersions.storyId, storyId))
      .orderBy(asc(storyTextVersions.versionNumber))

    res.json(versions)
  } catch (err) {
    console.error(`GET /stories/${storyId}/text-versions failed:`, err)
    res.status(500).json({ error: 'Failed to fetch text versions' })
  }
})

router.get('/:versionId', async (req: Request<VersionParams>, res) => {
  const storyId = parseId(req.params.id)
  const versionId = parseId(req.params.versionId)

  if (isNaN(storyId) || isNaN(versionId)) {
    res.status(400).json({ error: 'Invalid params' })
    return
  }

  try {
    const [version] = await db
      .select()
      .from(storyTextVersions)
      .where(and(eq(storyTextVersions.id, versionId), eq(storyTextVersions.storyId, storyId)))

    if (!version) {
      res.status(404).json({ error: 'Version not found' })
      return
    }

    res.json({
      id: version.id,
      version_number: version.versionNumber,
      model_id: version.modelId,
      stage: version.stage,
      created_at: version.createdAt,
      text: version.text,
    })
  } catch (err) {
    console.error(`GET /stories/${storyId}/text-versions/${versionId} failed:`, err)
    res.status(500).json({ error: 'Failed to fetch text version' })
  }
})

router.post('/:versionId/restore', async (req: Request<VersionParams>, res) => {
  const storyId = parseId(req.params.id)
  const versionId = parseId(req.params.versionId)

  if (isNaN(storyId) || isNaN(versionId)) {
    res.status(400).json({ error: 'Invalid params' })
    return
  }

  try {
    const [version] = await db
      .select({ id: storyTextVersions.id })
      .from(storyTextVersions)
      .where(and(eq(storyTextVersions.id, versionId), eq(storyTextVersions.storyId, storyId)))

    if (!version) {
      res.status(404).json({ error: 'Version not found' })
      return
    }

    const [updated] = await db
      .update(stories)
      .set({ activeTextVersionId: versionId, textFinal: null, status: 'draft', updatedAt: new Date() })
      .where(eq(stories.id, storyId))
      .returning()

    res.json({ ok: true, story: updated })
  } catch (err) {
    console.error(`POST /stories/${storyId}/text-versions/${versionId}/restore failed:`, err)
    res.status(500).json({ error: 'Failed to restore text version' })
  }
})

export default router
