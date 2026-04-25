import { describe, it, expect } from 'vitest'
import { deriveCatalogSyncDiff, type UpstreamModel } from './derive-catalog-sync-diff'

const u = (id: string): UpstreamModel => ({
  id,
  name: id,
  inputUsdPerMillion: 1,
  outputUsdPerMillion: 2,
  contextLength: 100000,
  supportsJsonSchema: true,
  isFree: false,
})

describe('deriveCatalogSyncDiff', () => {
  it('upserts every upstream model', () => {
    const diff = deriveCatalogSyncDiff({
      upstream: [u('a'), u('b')],
      current: [],
    })

    expect(diff.toUpsert.map((m) => m.id)).toEqual(['a', 'b'])
    expect(diff.toSoftDelete).toEqual([])
    expect(diff.toUndelete).toEqual([])
  })

  it('soft-deletes catalog rows missing from upstream', () => {
    const diff = deriveCatalogSyncDiff({
      upstream: [u('a')],
      current: [
        { id: 'a', deletedAt: null },
        { id: 'gone', deletedAt: null },
      ],
    })

    expect(diff.toSoftDelete).toEqual(['gone'])
  })

  it('does not re-soft-delete an already soft-deleted row', () => {
    const diff = deriveCatalogSyncDiff({
      upstream: [u('a')],
      current: [{ id: 'gone', deletedAt: new Date() }],
    })

    expect(diff.toSoftDelete).toEqual([])
  })

  it('undeletes a soft-deleted row that reappears upstream', () => {
    const diff = deriveCatalogSyncDiff({
      upstream: [u('a')],
      current: [{ id: 'a', deletedAt: new Date() }],
    })

    expect(diff.toUndelete).toEqual(['a'])
  })

  it('partitions a mixed set correctly', () => {
    const diff = deriveCatalogSyncDiff({
      upstream: [u('a'), u('b'), u('c')],
      current: [
        { id: 'a', deletedAt: null },
        { id: 'b', deletedAt: new Date() },
        { id: 'd', deletedAt: null },
      ],
    })

    expect(diff.toUpsert.map((m) => m.id).sort()).toEqual(['a', 'b', 'c'])
    expect(diff.toSoftDelete).toEqual(['d'])
    expect(diff.toUndelete).toEqual(['b'])
  })
})
