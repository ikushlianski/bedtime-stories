import { isNull, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { modelCatalog } from '../db/schema.js'
import { env } from '../env.js'
import { OpenRouterClient } from './openrouter.client.js'
import { deriveCatalogSyncDiff, type UpstreamModel } from './derive-catalog-sync-diff.js'

interface RawModel {
  id: string
  name: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
  supported_features?: string[]
  supported_parameters?: string[]
}

export function parseUpstreamModels(payload: unknown): UpstreamModel[] {
  const data = (payload as { data?: RawModel[] }).data ?? []
  const result: UpstreamModel[] = []

  for (const m of data) {
    if (typeof m.id !== 'string' || typeof m.name !== 'string') continue

    const promptPerToken = parseFloat(m.pricing?.prompt ?? '0')
    const completionPerToken = parseFloat(m.pricing?.completion ?? '0')
    const features = m.supported_features ?? m.supported_parameters ?? []

    result.push({
      id: m.id,
      name: m.name,
      inputUsdPerMillion: promptPerToken * 1_000_000,
      outputUsdPerMillion: completionPerToken * 1_000_000,
      contextLength: m.context_length ?? 0,
      supportsJsonSchema: features.includes('structured_outputs') || features.includes('response_format'),
      isFree: promptPerToken === 0 && completionPerToken === 0,
    })
  }

  return result
}

export interface SyncResult {
  fetched: number
  upserted: number
  softDeleted: number
  undeleted: number
}

export async function syncOpenRouterCatalog(
  client: OpenRouterClient = new OpenRouterClient(env.OPENROUTER_API_KEY),
): Promise<SyncResult> {
  const payload = await client.listModels()
  const upstream = parseUpstreamModels(payload)

  const current = await db.select({ id: modelCatalog.id, deletedAt: modelCatalog.deletedAt }).from(modelCatalog)

  const diff = deriveCatalogSyncDiff({ upstream, current })
  const now = new Date()

  for (const m of diff.toUpsert) {
    await db
      .insert(modelCatalog)
      .values({
        id: m.id,
        name: m.name,
        inputUsdPerMillion: m.inputUsdPerMillion.toString(),
        outputUsdPerMillion: m.outputUsdPerMillion.toString(),
        contextLength: m.contextLength,
        supportsJsonSchema: m.supportsJsonSchema,
        isFree: m.isFree,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: modelCatalog.id,
        set: {
          name: m.name,
          inputUsdPerMillion: m.inputUsdPerMillion.toString(),
          outputUsdPerMillion: m.outputUsdPerMillion.toString(),
          contextLength: m.contextLength,
          supportsJsonSchema: m.supportsJsonSchema,
          isFree: m.isFree,
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

  void isNull
  void eq

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
