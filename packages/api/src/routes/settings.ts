import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { appSettings } from '@bedtime/core/db/schema'
import { validate } from '../middleware/validate'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1))

    res.json({ stageModels: row?.stageModels ?? {} })
  } catch (err) {
    console.error('GET /settings failed:', err)
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

const updateSettingsSchema = z.object({
  stageModels: z.record(
    z.string(),
    z.object({
      model: z.string().optional(),
      fallback: z.string().optional(),
    }),
  ).optional(),
})

router.patch('/', validate(updateSettingsSchema), async (req, res) => {
  try {
    const { stageModels } = req.body as z.infer<typeof updateSettingsSchema>

    const models = (stageModels ?? {}) as Record<string, { model?: string; fallback?: string }>

    const [updated] = await db
      .insert(appSettings)
      .values({ id: 1, stageModels: models, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { stageModels: models, updatedAt: new Date() },
      })
      .returning()

    res.json({ stageModels: updated?.stageModels ?? {} })
  } catch (err) {
    console.error('PATCH /settings failed:', err)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

export default router
