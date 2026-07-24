import { Storage } from '@google-cloud/storage'
import { env } from '../env.js'

let storageClient: Storage | null = null

function getStorage(): Storage {
  if (!storageClient) {
    storageClient = new Storage()
  }

  return storageClient
}

export function isGcsConfigured(): boolean {
  return env.GCS_BUCKET_NAME !== undefined
}

export async function uploadImage(path: string, bytes: Buffer, contentType: string): Promise<void> {
  if (!env.GCS_BUCKET_NAME) {
    throw new Error('GCS_BUCKET_NAME is not configured')
  }

  const file = getStorage().bucket(env.GCS_BUCKET_NAME).file(path)

  await file.save(bytes, { contentType, resumable: false })
}

export interface StoredImage {
  bytes: Buffer
  contentType: string
}

export async function deleteImage(path: string): Promise<void> {
  if (!env.GCS_BUCKET_NAME) {
    throw new Error('GCS_BUCKET_NAME is not configured')
  }

  const file = getStorage().bucket(env.GCS_BUCKET_NAME).file(path)

  await file.delete({ ignoreNotFound: true })
}

export async function readImage(path: string): Promise<StoredImage | null> {
  if (!env.GCS_BUCKET_NAME) {
    return null
  }

  const file = getStorage().bucket(env.GCS_BUCKET_NAME).file(path)
  const [exists] = await file.exists()

  if (!exists) {
    return null
  }

  const [downloadResult, metadataResult] = await Promise.all([file.download(), file.getMetadata()])

  return {
    bytes: downloadResult[0],
    contentType: metadataResult[0].contentType ?? 'application/octet-stream',
  }
}
