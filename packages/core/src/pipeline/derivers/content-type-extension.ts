export type ImageExtension = 'png' | 'jpg' | 'webp'

const CONTENT_TYPE_TO_EXTENSION: Record<string, ImageExtension> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export function deriveContentTypeExtension(mimeType: string): ImageExtension | null {
  return CONTENT_TYPE_TO_EXTENSION[mimeType.toLowerCase()] ?? null
}
