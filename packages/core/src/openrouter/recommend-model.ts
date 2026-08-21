import { and, isNull, or, gte, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { modelCatalog } from '../db/schema.js'
import type { PipelineStage } from '../pipeline/derivers/per-stage-models.js'

export interface ModelRequirements {
  needsJsonSchema: boolean
  minOutputTokens: number
}

const STAGE_REQUIREMENTS: Record<PipelineStage, ModelRequirements> = {
  plotter:               { needsJsonSchema: false, minOutputTokens: 2000 },
  plotCritic:            { needsJsonSchema: true,  minOutputTokens: 1000 },
  writer:                { needsJsonSchema: false, minOutputTokens: 4000 },
  writerCritic:          { needsJsonSchema: true,  minOutputTokens: 1000 },
  psychologistPlan:      { needsJsonSchema: true,  minOutputTokens: 1000 },
  psychologistText:      { needsJsonSchema: true,  minOutputTokens: 1000 },
  plotterQuestions:      { needsJsonSchema: true,  minOutputTokens: 1000 },
  improver:              { needsJsonSchema: false, minOutputTokens: 2000 },
  titleGenerator:        { needsJsonSchema: false, minOutputTokens: 200  },
  storyAnalyzer:         { needsJsonSchema: true,  minOutputTokens: 1000 },
  universeFactExtractor: { needsJsonSchema: true,  minOutputTokens: 500  },
  feedbackSynthesizer:   { needsJsonSchema: false, minOutputTokens: 1000 },
  styleGuideUpdater:     { needsJsonSchema: false, minOutputTokens: 1000 },
  universeContextUpdater:{ needsJsonSchema: false, minOutputTokens: 1000 },
  ideaSuggester:         { needsJsonSchema: true,  minOutputTokens: 1000 },
  illustrationMomentSelector: { needsJsonSchema: true, minOutputTokens: 500 },
}

export async function recommendModelForStage(stage: PipelineStage): Promise<string | null> {
  return recommendCheapestModel(STAGE_REQUIREMENTS[stage])
}

export async function recommendCheapestModel(req: ModelRequirements): Promise<string | null> {
  const filters = [
    isNull(modelCatalog.deletedAt),
    sql`${modelCatalog.modality} LIKE '%->text%'`,
    or(
      isNull(modelCatalog.maxOutputTokens),
      gte(modelCatalog.maxOutputTokens, req.minOutputTokens),
    ),
  ]

  if (req.needsJsonSchema) {
    filters.push(sql`${modelCatalog.supportsJsonSchema} = true`)
  }

  const rows = await db
    .select({ id: modelCatalog.id })
    .from(modelCatalog)
    .where(and(...filters))
    .orderBy(
      sql`
        CASE
          WHEN ${modelCatalog.isFree} = true AND ${modelCatalog.expirationDate} IS NULL THEN 0
          WHEN ${modelCatalog.isFree} = true THEN 1
          ELSE 2
        END ASC
      `,
      sql`
        (COALESCE(${modelCatalog.inputUsdPerMillion}::numeric, 0) +
         COALESCE(${modelCatalog.outputUsdPerMillion}::numeric, 0)) ASC
      `,
    )
    .limit(1)

  return rows[0]?.id ?? null
}
