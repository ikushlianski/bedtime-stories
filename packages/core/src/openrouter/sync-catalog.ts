import { inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { modelCatalog } from '../db/schema.js'
import { env } from '../env.js'
import { fetchOpenRouterCatalog } from './openrouter-catalog-fetcher.js'
import { deriveCatalogSyncDiff } from './derive-catalog-sync-diff.js'

const POPULAR_MODEL_IDS: readonly string[] = [
  'anthropic/claude-opus-4.5',
  'anthropic/claude-sonnet-4.5',
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-sonnet-4.6',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/o3',
  'openai/o4-mini',
  'openai/o1',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.3-70b-instruct',
  'meta-llama/llama-4-maverick',
  'mistralai/mistral-large-2411',
  'mistralai/mistral-small-3.2-24b-instruct',
  'deepseek/deepseek-chat-v3-0324',
  'deepseek/deepseek-r1',
  'qwen/qwen3-235b-a22b',
  'x-ai/grok-3',
]

export interface SyncResult {
  fetched: number
  upserted: number
  softDeleted: number
  undeleted: number
}

export async function syncOpenRouterCatalog(): Promise<SyncResult> {
  const upstream = await fetchOpenRouterCatalog(env.OPENROUTER_API_KEY)

  const current = await db.select({ id: modelCatalog.id, deletedAt: modelCatalog.deletedAt }).from(modelCatalog)

  const diff = deriveCatalogSyncDiff({ upstream, current })
  const now = new Date()

  const popularityIndex = new Map(POPULAR_MODEL_IDS.map((id, i) => [id, i + 1]))

  for (const m of diff.toUpsert) {
    const popularityRank = popularityIndex.get(m.id) ?? null

    await db
      .insert(modelCatalog)
      .values({
        id: m.id,
        name: m.name,
        description: m.description,
        createdByProvider: m.createdByProvider,
        inputUsdPerMillion: m.inputUsdPerMillion.toString(),
        outputUsdPerMillion: m.outputUsdPerMillion.toString(),
        imageUsdPerRequest: m.imageUsdPerRequest?.toString() ?? null,
        contextLength: m.contextLength,
        maxOutputTokens: m.maxOutputTokens,
        modality: m.modality,
        inputModalities: m.inputModalities,
        tokenizer: m.tokenizer,
        instructType: m.instructType,
        supportsJsonSchema: m.supportsJsonSchema,
        isFree: m.isFree,
        isModerated: m.isModerated,
        expirationDate: m.expirationDate,
        popularityRank,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: modelCatalog.id,
        set: {
          name: m.name,
          description: m.description,
          createdByProvider: m.createdByProvider,
          inputUsdPerMillion: m.inputUsdPerMillion.toString(),
          outputUsdPerMillion: m.outputUsdPerMillion.toString(),
          imageUsdPerRequest: m.imageUsdPerRequest?.toString() ?? null,
          contextLength: m.contextLength,
          maxOutputTokens: m.maxOutputTokens,
          modality: m.modality,
          inputModalities: m.inputModalities,
          tokenizer: m.tokenizer,
          instructType: m.instructType,
          supportsJsonSchema: m.supportsJsonSchema,
          isFree: m.isFree,
          isModerated: m.isModerated,
          expirationDate: m.expirationDate,
          popularityRank,
          lastSyncedAt: now,
        },
      })
  }

  if (diff.toSoftDelete.length > 0) {
    await db
      .update(modelCatalog)
      .set({ deletedAt: now })
      .where(inArray(modelCatalog.id, diff.toSoftDelete))
  }

  if (diff.toUndelete.length > 0) {
    await db
      .update(modelCatalog)
      .set({ deletedAt: null })
      .where(inArray(modelCatalog.id, diff.toUndelete))
  }

  const result: SyncResult = {
    fetched: upstream.length,
    upserted: diff.toUpsert.length,
    softDeleted: diff.toSoftDelete.length,
    undeleted: diff.toUndelete.length,
  }

  console.log(`[catalog-sync] fetched=${result.fetched} upserted=${result.upserted} softDeleted=${result.softDeleted} undeleted=${result.undeleted}`)
  return result
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

let scheduled = false

export function scheduleDailyCatalogSync(): void {
  if (scheduled) return
  scheduled = true

  void syncOpenRouterCatalog().catch((err) => {
    console.error('[catalog-sync] initial sync failed:', err)
  })

  setInterval(() => {
    void syncOpenRouterCatalog().catch((err) => {
      console.error('[catalog-sync] scheduled sync failed:', err)
    })
  }, ONE_DAY_MS).unref()
}
