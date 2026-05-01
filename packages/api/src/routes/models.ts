import { Router } from 'express'
import { and, eq, isNull, isNotNull, asc, desc } from 'drizzle-orm'
import { db } from '@bedtime/core/db/client'
import { modelCatalog } from '@bedtime/core/db/schema'

const CATEGORY_LIMIT = 20

const COLS = {
  id: modelCatalog.id,
  name: modelCatalog.name,
  inputUsdPerMillion: modelCatalog.inputUsdPerMillion,
  outputUsdPerMillion: modelCatalog.outputUsdPerMillion,
  contextLength: modelCatalog.contextLength,
  supportsJsonSchema: modelCatalog.supportsJsonSchema,
  isFree: modelCatalog.isFree,
  isRecommendedForProse: modelCatalog.isRecommendedForProse,
  expirationDate: modelCatalog.expirationDate,
  popularityRank: modelCatalog.popularityRank,
}

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const [popular, free, newModels, temporary] = await Promise.all([
      db.select(COLS)
        .from(modelCatalog)
        .where(and(isNull(modelCatalog.deletedAt), isNotNull(modelCatalog.popularityRank)))
        .orderBy(asc(modelCatalog.popularityRank)),

      db.select(COLS)
        .from(modelCatalog)
        .where(and(isNull(modelCatalog.deletedAt), eq(modelCatalog.isFree, true)))
        .orderBy(desc(modelCatalog.contextLength))
        .limit(CATEGORY_LIMIT),

      db.select(COLS)
        .from(modelCatalog)
        .where(and(isNull(modelCatalog.deletedAt), isNull(modelCatalog.expirationDate)))
        .orderBy(desc(modelCatalog.createdByProvider))
        .limit(CATEGORY_LIMIT),

      db.select(COLS)
        .from(modelCatalog)
        .where(and(isNull(modelCatalog.deletedAt), isNotNull(modelCatalog.expirationDate)))
        .orderBy(desc(modelCatalog.createdByProvider))
        .limit(CATEGORY_LIMIT),
    ])

    res.json({ popular, free, new: newModels, temporary })
  } catch (err) {
    console.error('GET /models failed:', err)
    res.status(500).json({ error: 'Failed to list models' })
  }
})

export default router
