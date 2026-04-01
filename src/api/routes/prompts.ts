import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate'

// TODO: import { db } from '../db/client' when BE-1 is merged
// For now use a stub:
const db = null as any // will be replaced

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
    // DB: stub — replace with real db calls after merge
    const agentParam: string = req.params['agent'] ?? ''
    const agent = parseAgent(agentParam)

    if (!agent) {
      res.status(400).json({ error: 'Invalid agent name' })
      return
    }

    const prompts = await db
      .select()
      .from('prompts')
      .where({ agent })
      .orderBy('version', 'desc')

    res.json(prompts)
  } catch {
    res.status(500).json({ error: 'Failed to fetch prompts' })
  }
})

router.get('/:agent/current', async (req, res) => {
  try {
    // DB: stub — replace with real db calls after merge
    const agentParam: string = req.params['agent'] ?? ''
    const agent = parseAgent(agentParam)

    if (!agent) {
      res.status(400).json({ error: 'Invalid agent name' })
      return
    }

    const prompt = await db
      .select()
      .from('prompts')
      .where({ agent })
      .orderBy('version', 'desc')
      .limit(1)
      .first()

    if (!prompt) {
      res.status(404).json({ error: 'No prompts found for this agent' })
      return
    }

    res.json(prompt)
  } catch {
    res.status(500).json({ error: 'Failed to fetch current prompt' })
  }
})

router.post('/:agent', validate(createPromptSchema), async (req, res) => {
  try {
    // DB: stub — replace with real db calls after merge
    const agentParam: string = req.params['agent'] ?? ''
    const agent = parseAgent(agentParam)

    if (!agent) {
      res.status(400).json({ error: 'Invalid agent name' })
      return
    }

    const { text, change_reason, source_feedbacks } = req.body as z.infer<typeof createPromptSchema>
    const latest = await db
      .select()
      .from('prompts')
      .where({ agent })
      .orderBy('version', 'desc')
      .limit(1)
      .first()
    const nextVersion = latest ? (latest.version as number) + 1 : 1
    const prompt = await db
      .insert('prompts')
      .values({ agent, text, change_reason, source_feedbacks, version: nextVersion })
      .returning()

    res.status(201).json(prompt)
  } catch {
    res.status(500).json({ error: 'Failed to create prompt' })
  }
})

export default router
