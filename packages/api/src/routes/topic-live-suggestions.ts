import { Router } from 'express'
import { z } from 'zod'
import { suggestLiveTopicsForOutline } from '@bedtime/core/pipeline/suggest-live-topics'
import { validate } from '../middleware/validate'

const router = Router()

const suggestSchema = z.object({
  universeId: z.number().int().positive(),
  outline: z.string().min(1).max(5000),
})

router.post('/', validate(suggestSchema), async (req, res) => {
  try {
    const { universeId, outline } = req.body as z.infer<typeof suggestSchema>

    const suggestions = await suggestLiveTopicsForOutline(universeId, outline)

    res.json({ suggestions })
  } catch (err) {
    console.error('POST /topic-live-suggestions failed:', err)
    res.status(500).json({ error: 'Failed to suggest topics' })
  }
})

export default router
