import { describe, it, expect } from 'vitest'
import { validateReferenceUpload, MAX_REFERENCE_FILE_SIZE_BYTES, MAX_REFERENCE_FILES_PER_UPLOAD } from './validate-reference-upload'

describe('validateReferenceUpload', () => {
  it('accepts a png within the size limit', () => {
    const result = validateReferenceUpload({ mimetype: 'image/png', sizeBytes: 1024 }, 1)

    expect(result).toEqual({ ok: true })
  })

  it('accepts a jpeg and a webp within the size limit', () => {
    expect(validateReferenceUpload({ mimetype: 'image/jpeg', sizeBytes: 1024 }, 1)).toEqual({ ok: true })
    expect(validateReferenceUpload({ mimetype: 'image/webp', sizeBytes: 1024 }, 1)).toEqual({ ok: true })
  })

  it('rejects a non-image file with a message naming the reason', () => {
    const result = validateReferenceUpload({ mimetype: 'application/pdf', sizeBytes: 1024 }, 1)

    expect(result.ok).toBe(false)
    expect((result as { ok: false; reason: string }).reason).toMatch(/type/i)
  })

  it('rejects a file over the size limit with a message naming the reason', () => {
    const result = validateReferenceUpload({ mimetype: 'image/png', sizeBytes: MAX_REFERENCE_FILE_SIZE_BYTES + 1 }, 1)

    expect(result.ok).toBe(false)
    expect((result as { ok: false; reason: string }).reason).toMatch(/large/i)
  })

  it('accepts a file exactly at the size limit', () => {
    expect(validateReferenceUpload({ mimetype: 'image/png', sizeBytes: MAX_REFERENCE_FILE_SIZE_BYTES }, 1)).toEqual({ ok: true })
  })

  it('rejects when the batch count exceeds the per-request cap', () => {
    const result = validateReferenceUpload({ mimetype: 'image/png', sizeBytes: 1024 }, MAX_REFERENCE_FILES_PER_UPLOAD + 1)

    expect(result.ok).toBe(false)
    expect((result as { ok: false; reason: string }).reason).toMatch(/many files/i)
  })

  it('accepts a batch exactly at the per-request cap', () => {
    expect(validateReferenceUpload({ mimetype: 'image/png', sizeBytes: 1024 }, MAX_REFERENCE_FILES_PER_UPLOAD)).toEqual({ ok: true })
  })
})
