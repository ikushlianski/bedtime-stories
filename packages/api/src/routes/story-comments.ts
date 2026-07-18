import { Router, type Request } from 'express'
import { z } from 'zod'
import { eq, asc } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { stories, storyComments } from '@bedtime/core/db/schema'
import { resolveChatGate } from '@bedtime/core/pipeline/resolve-chat-gate'
import { buildStoryCommentRecord } from '@bedtime/core/pipeline/build-story-comment-record'
import { validate } from '../middleware/validate'

type StoryParams = { id: string }

const router = Router({ mergeParams: true })

const createCommentSchema = z.object({
  comment_text: z.string().min(1),
  selected_text: z.string().optional(),
})

router.post('/', validate(createCommentSchema), async (req: Request<StoryParams>, res) => {
  try {
    const storyId = parseInt(req.params['id'] ?? '', 10)

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const { comment_text, selected_text } = req.body as z.infer<typeof createCommentSchema>

    const [storyRow] = await db.select().from(stories).where(eq(stories.id, storyId))

    if (!storyRow) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    const gate = resolveChatGate({ storyStatus: storyRow.status ?? 'draft', intent: 'record' })

    if (!gate.allowed) {
      res.status(409).json({ error: gate.reason, suggestedEndpoint: gate.suggestedEndpoint })
      return
    }

    const insertPayload = buildStoryCommentRecord({
      storyId,
      groupId: storyRow.groupId ?? null,
      commentText: comment_text,
      selectedText: selected_text ?? null,
    })

    const [created] = await db
      .insert(storyComments)
      .values({
        storyId: insertPayload.storyId,
        universeId: insertPayload.universeId,
        commentText: insertPayload.commentText,
        selectedText: insertPayload.selectedText,
      })
      .returning()

    res.status(201).json(created)
  } catch (err) {
    console.error('POST /stories/:id/comments failed:', err)
    res.status(500).json({ error: 'Failed to create comment' })
  }
})

router.get('/', async (req: Request<StoryParams>, res) => {
  try {
    const storyId = parseInt(req.params['id'] ?? '', 10)

    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }

    const result = await db
      .select()
      .from(storyComments)
      .where(eq(storyComments.storyId, storyId))
      .orderBy(asc(storyComments.createdAt))

    res.json(result)
  } catch (err) {
    console.error('GET /stories/:id/comments failed:', err)
    res.status(500).json({ error: 'Failed to fetch comments' })
  }
})

export default router
