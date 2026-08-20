export interface ValidateReferenceUploadInput {
  mimetype: string
  sizeBytes: number
}

export type ValidateReferenceUploadResult = { ok: true } | { ok: false; reason: string }

export const MAX_REFERENCE_FILES_PER_UPLOAD = 5
export const MAX_REFERENCE_FILE_SIZE_BYTES = 8 * 1024 * 1024
export const ALLOWED_REFERENCE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export function validateReferenceUpload(input: ValidateReferenceUploadInput, batchCount: number): ValidateReferenceUploadResult {
  if (batchCount > MAX_REFERENCE_FILES_PER_UPLOAD) {
    return { ok: false, reason: `Too many files in one upload — max ${MAX_REFERENCE_FILES_PER_UPLOAD} at a time` }
  }

  if (!(ALLOWED_REFERENCE_MIME_TYPES as readonly string[]).includes(input.mimetype)) {
    return { ok: false, reason: `Unsupported file type: ${input.mimetype} — only PNG, JPEG, and WebP are allowed` }
  }

  if (input.sizeBytes > MAX_REFERENCE_FILE_SIZE_BYTES) {
    const maxMb = MAX_REFERENCE_FILE_SIZE_BYTES / (1024 * 1024)
    return { ok: false, reason: `File is too large — max ${maxMb}MB` }
  }

  return { ok: true }
}
