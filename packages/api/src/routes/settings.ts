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

    res.json({ stageModels: row?.stageModels ?? {}, featureFlags: row?.featureFlags ?? {} })
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
  featureFlags: z.record(z.string(), z.boolean()).optional(),
})

router.patch('/', validate(updateSettingsSchema), async (req, res) => {
  try {
    const { stageModels, featureFlags } = req.body as z.infer<typeof updateSettingsSchema>

    const [existing] = await db.select().from(appSettings).where(eq(appSettings.id, 1))

    const nextStageModels = (stageModels ?? existing?.stageModels ?? {}) as Record<string, { model?: string; fallback?: string }>
    const nextFeatureFlags = (featureFlags ?? existing?.featureFlags ?? {}) as Record<string, boolean>

    const [updated] = await db
      .insert(appSettings)
      .values({ id: 1, stageModels: nextStageModels, featureFlags: nextFeatureFlags, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { stageModels: nextStageModels, featureFlags: nextFeatureFlags, updatedAt: new Date() },
      })
      .returning()

    res.json({ stageModels: updated?.stageModels ?? {}, featureFlags: updated?.featureFlags ?? {} })
  } catch (err) {
    console.error('PATCH /settings failed:', err)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

export default router
