import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const DEFAULT_STYLE_REFERENCE_PATH = join(import.meta.dirname, 'default-character-style-reference.png')

export async function loadDefaultStyleImageDataUri(): Promise<string> {
  const defaultImageBuffer = await readFile(DEFAULT_STYLE_REFERENCE_PATH)
  return `data:image/png;base64,${defaultImageBuffer.toString('base64')}`
}
