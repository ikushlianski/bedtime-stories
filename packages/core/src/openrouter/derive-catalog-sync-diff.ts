export interface UpstreamModel {
  id: string
  name: string
  inputUsdPerMillion: number
  outputUsdPerMillion: number
  contextLength: number
  supportsJsonSchema: boolean
  isFree: boolean
}

export interface CatalogRow {
  id: string
  deletedAt: Date | null
}

export interface CatalogSyncDiff {
  toUpsert: UpstreamModel[]
  toSoftDelete: string[]
  toUndelete: string[]
}

export function deriveCatalogSyncDiff(input: {
  upstream: UpstreamModel[]
  current: CatalogRow[]
}): CatalogSyncDiff {
  const upstreamIds = new Set(input.upstream.map((m) => m.id))

  const toSoftDelete: string[] = []
  const toUndelete: string[] = []

  for (const row of input.current) {
    const stillUpstream = upstreamIds.has(row.id)

    if (!stillUpstream && row.deletedAt === null) {
      toSoftDelete.push(row.id)
    }

    if (stillUpstream && row.deletedAt !== null) {
      toUndelete.push(row.id)
    }
  }

  return { toUpsert: input.upstream.slice(), toSoftDelete, toUndelete }
}
