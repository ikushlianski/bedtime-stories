import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ObjectStorage } from '../storage/object-storage.interface'

let insertedValues: unknown = null
let returningRow: unknown = { id: 1, characterId: 5, storagePath: 'references/5/x.png', uploadedAt: new Date() }

vi.mock('../db/client.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertedValues = values
        return { returning: vi.fn(async () => [returningRow]) }
      }),
    })),
  },
}))

import { saveReferenceImage } from './save-reference-image'

function makeStorage(): ObjectStorage & { uploadCalls: unknown[] } {
  const uploadCalls: unknown[] = []
  return {
    uploadCalls,
    upload: vi.fn(async (input) => {
      uploadCalls.push(input)
    }),
    getSignedReadUrl: vi.fn(async () => 'https://signed.example.com/x'),
    delete: vi.fn(async () => {}),
  }
}

describe('saveReferenceImage', () => {
  beforeEach(() => {
    insertedValues = null
    returningRow = { id: 1, characterId: 5, storagePath: 'references/5/x.png', uploadedAt: new Date() }
  })

  it('uploads the buffer under the references/ prefix and stores the storage path, not a URL', async () => {
    const storage = makeStorage()
    const buffer = Buffer.from('fake-image-bytes')

    const result = await saveReferenceImage({ characterId: 5, buffer, mimetype: 'image/png' }, storage)

    expect(storage.upload).toHaveBeenCalledTimes(1)
    const uploadCall = storage.uploadCalls[0] as { path: string; data: Buffer; contentType: string }
    expect(uploadCall.path).toMatch(/^references\/5\//)
    expect(uploadCall.data).toBe(buffer)
    expect(uploadCall.contentType).toBe('image/png')

    expect(insertedValues).toMatchObject({ characterId: 5 })
    expect((insertedValues as { storagePath: string }).storagePath).toMatch(/^references\/5\//)
    expect(result).toEqual(returningRow)
  })

  it('maps jpeg and webp mimetypes to matching file extensions', async () => {
    const storage = makeStorage()

    await saveReferenceImage({ characterId: 5, buffer: Buffer.from('x'), mimetype: 'image/jpeg' }, storage)
    expect((insertedValues as { storagePath: string }).storagePath).toMatch(/\.jpg$/)

    await saveReferenceImage({ characterId: 5, buffer: Buffer.from('x'), mimetype: 'image/webp' }, storage)
    expect((insertedValues as { storagePath: string }).storagePath).toMatch(/\.webp$/)
  })
})
