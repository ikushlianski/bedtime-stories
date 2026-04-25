import { Router, type Request } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { valueForMoneyFeedback, stories } from '@bedtime/core/db/schema'
import { validate } from '../middleware/validate'

const vfmSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().optional(),
})

type StoryParams = { id: string }

const router = Router({ mergeParams: true })

router.post('/', validate(vfmSchema), async (req: Request<StoryParams>, res) => {
  const storyId = parseInt(req.params['id'] ?? '', 10)

  if (isNaN(storyId)) {
    res.status(400).json({ error: 'Invalid story id' })
    return
  }

  const { rating, note } = req.body as z.infer<typeof vfmSchema>

  try {
    const [storyRow] = await db.select({ id: stories.id }).from(stories).where(eq(stories.id, storyId)).limit(1)

    if (!storyRow) {
      res.status(404).json({ error: 'Story not found' })
      return
    }

    const [created] = await db
      .insert(valueForMoneyFeedback)
      .values({ storyId, rating, note: note ?? null })
      .onConflictDoUpdate({
        target: valueForMoneyFeedback.storyId,
        set: { rating, note: note ?? null },
      })
      .returning()

    res.status(201).json(created)
  } catch (err) {
    console.error('POST /stories/:id/value-for-money failed:', err)
    res.status(500).json({ error: 'Failed to record value-for-money feedback' })
  }
})

export default router
