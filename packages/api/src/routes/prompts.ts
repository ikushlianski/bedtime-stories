import { Router } from 'express'
import { z } from 'zod'
import { eq, desc, max } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { prompts } from '@bedtime/core/db/schema'
import type { NewPrompt } from '@bedtime/core/db/types'
import { validate } from '../middleware/validate'

const router = Router()

const agentSchema = z.enum(['plotter', 'plot_critic', 'writer', 'writer_critic', 'improver'])

const createPromptSchema = z.object({
  text: z.string().min(1),
  change_reason: z.string().min(1),
  source_feedbacks: z.array(z.number().int()),
})

function parseAgent(agent: string): z.infer<typeof agentSchema> | null {
  const result = agentSchema.safeParse(agent)
  return result.success ? result.data : null
}

router.get('/:agent', async (req, res) => {
  try {
    const raw = req.params['agent']
    const agentParam = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
    const agent = parseAgent(agentParam)

    if (!agent) {
      res.status(400).json({ error: 'Invalid agent name' })
      return
    }

    const result = await db
      .select()
      .from(prompts)
      .where(eq(prompts.agent, agent))
      .orderBy(desc(prompts.version))

    res.json(result)
  } catch (err) {
    console.error('GET /prompts/:agent failed:', err)
    res.status(500).json({ error: 'Failed to fetch prompts' })
  }
})

router.get('/:agent/current', async (req, res) => {
  try {
    const raw = req.params['agent']
    const agentParam = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
    const agent = parseAgent(agentParam)

    if (!agent) {
      res.status(400).json({ error: 'Invalid agent name' })
      return
    }

    const [prompt] = await db
      .select()
      .from(prompts)
      .where(eq(prompts.agent, agent))
      .orderBy(desc(prompts.version))
      .limit(1)

    if (!prompt) {
      res.status(404).json({ error: 'No prompts found for this agent' })
      return
    }

    res.json(prompt)
  } catch (err) {
    console.error('GET /prompts/:agent/current failed:', err)
    res.status(500).json({ error: 'Failed to fetch current prompt' })
  }
})

router.post('/:agent', validate(createPromptSchema), async (req, res) => {
  try {
    const raw = req.params['agent']
    const agentParam = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
    const agent = parseAgent(agentParam)

    if (!agent) {
      res.status(400).json({ error: 'Invalid agent name' })
      return
    }

    const { text, change_reason, source_feedbacks } = req.body as z.infer<typeof createPromptSchema>

    const [maxRow] = await db
      .select({ maxVersion: max(prompts.version) })
      .from(prompts)
      .where(eq(prompts.agent, agent))

    const nextVersion = (maxRow?.maxVersion ?? 0) + 1

    const newPrompt: NewPrompt = {
      agent,
      text,
      changeReason: change_reason,
      sourceFeedbacks: source_feedbacks,
      version: nextVersion,
    }

    const [prompt] = await db.insert(prompts).values(newPrompt).returning()

    res.status(201).json(prompt)
  } catch (err) {
    console.error('POST /prompts/:agent failed:', err)
    res.status(500).json({ error: 'Failed to create prompt' })
  }
})

export default router
