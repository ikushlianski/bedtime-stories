import { describe, it, expect } from 'vitest'
import { buildPublicObjectUrl } from './build-public-object-url'

describe('buildPublicObjectUrl', () => {
  it('builds the deterministic public storage URL for a path', () => {
    const url = buildPublicObjectUrl({ bucketName: 'bedtime-prod-storage', storagePath: 'portraits/42/abc.png' })

    expect(url).toBe('https://storage.googleapis.com/bedtime-prod-storage/portraits/42/abc.png')
  })

  it('does not add a public-read assumption for a references/ path — it is pure string formatting', () => {
    const url = buildPublicObjectUrl({ bucketName: 'bedtime-prod-storage', storagePath: 'references/42/abc.png' })

    expect(url).toBe('https://storage.googleapis.com/bedtime-prod-storage/references/42/abc.png')
  })
})
