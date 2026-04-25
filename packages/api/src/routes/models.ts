import { Router } from 'express'
import { isNull } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { modelCatalog } from '@bedtime/core/db/schema'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: modelCatalog.id,
        name: modelCatalog.name,
        inputUsdPerMillion: modelCatalog.inputUsdPerMillion,
        outputUsdPerMillion: modelCatalog.outputUsdPerMillion,
        contextLength: modelCatalog.contextLength,
        supportsJsonSchema: modelCatalog.supportsJsonSchema,
        isFree: modelCatalog.isFree,
        isRecommendedForProse: modelCatalog.isRecommendedForProse,
      })
      .from(modelCatalog)
      .where(isNull(modelCatalog.deletedAt))

    res.json({ models: rows })
  } catch (err) {
    console.error('GET /models failed:', err)
    res.status(500).json({ error: 'Failed to list models' })
  }
})

export default router
