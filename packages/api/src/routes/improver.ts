import { Router } from 'express'
import { z } from 'zod'
import { eq, max, desc } from 'drizzle-orm'
import { validate } from '../middleware/validate'
import { runImprover } from '@bedtime/core/pipeline/stages/improver'
import { db } from '@bedtime/core/db/client'
import { feedback, prompts } from '@bedtime/core/db/schema'
import type { NewPrompt } from '@bedtime/core/db/types'

const router = Router()

const applyChangeSchema = z.object({
  agent: z.enum(['plotter', 'plot_critic', 'writer', 'writer_critic']),
  proposed_text: z.string().min(1),
  change_reason: z.string().min(1),
  source_feedback_ids: z.array(z.number().int()),
})

async function countAgentRunFeedbacks(): Promise<number> {
  const rows = await db
    .select({ id: feedback.id })
    .from(feedback)
    .where(eq(feedback.feedbackType, 'agent_run'))

  return rows.length
}

router.post('/run', async (_req, res) => {
  try {
    const count = await countAgentRunFeedbacks()

    if (count < 2) {
      res.status(400).json({ error: 'Not enough feedback' })
      return
    }

    const result = await runImprover()

    res.json(result)
  } catch {
    res.status(500).json({ error: 'Failed to run improver' })
  }
})

router.post('/apply', validate(applyChangeSchema), async (req, res) => {
  try {
    const { agent, proposed_text, change_reason, source_feedback_ids } =
      req.body as z.infer<typeof applyChangeSchema>

    const [maxRow] = await db
      .select({ maxVersion: max(prompts.version) })
      .from(prompts)
      .where(eq(prompts.agent, agent))

    const nextVersion = (maxRow?.maxVersion ?? 0) + 1

    const newPrompt: NewPrompt = {
      agent,
      text: proposed_text,
      changeReason: change_reason,
      sourceFeedbacks: source_feedback_ids,
      version: nextVersion,
    }

    const [prompt] = await db.insert(prompts).values(newPrompt).returning()

    res.status(201).json(prompt)
  } catch {
    res.status(500).json({ error: 'Failed to apply prompt change' })
  }
})

export default router
