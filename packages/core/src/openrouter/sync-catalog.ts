import { inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { modelCatalog } from '../db/schema.js'
import { env } from '../env.js'
import { fetchOpenRouterCatalog } from './openrouter-catalog-fetcher.js'
import { deriveCatalogSyncDiff } from './derive-catalog-sync-diff.js'

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

  for (const m of diff.toUpsert) {
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
