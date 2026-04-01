import { Router, Request } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'

// TODO: import { db } from '../db/client' when BE-1 is merged
// For now use a stub:
const db = null as any // will be replaced

type StoryParams = { id: string }

const router = Router({ mergeParams: true })

const createFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1),
  feedback_type: z.enum(['agent_run', 'retrospective']),
})

router.post('/', validate(createFeedbackSchema), async (req: Request<StoryParams>, res) => {
  try {
    // DB: stub — replace with real db calls after merge
    const { id } = req.params
    const { rating, comment, feedback_type } = req.body as z.infer<typeof createFeedbackSchema>
    const feedback = await db
      .insert('feedback')
      .values({ story_id: id, rating, comment, feedback_type })
      .returning()

    res.status(201).json(feedback)
  } catch {
    res.status(500).json({ error: 'Failed to create feedback' })
  }
})

router.get('/', async (req: Request<StoryParams>, res) => {
  try {
    // DB: stub — replace with real db calls after merge
    const { id } = req.params
    const feedbackList = await db.select().from('feedback').where({ story_id: id })

    res.json(feedbackList)
  } catch {
    res.status(500).json({ error: 'Failed to fetch feedback' })
  }
})

export default router
