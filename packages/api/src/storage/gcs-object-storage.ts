import type { ObjectStorage, UploadObjectInput } from '@bedtime/core/storage/object-storage.interface'
import { env } from '@bedtime/core/env'

interface GcsFile {
  save(data: Buffer, options: { contentType: string; resumable: boolean }): Promise<void>
  getSignedUrl(config: { version: 'v4'; action: 'read'; expires: number }): Promise<[string]>
  delete(): Promise<unknown>
}

interface GcsBucket {
  file(path: string): GcsFile
}

interface GcsStorageClient {
  bucket(name: string): GcsBucket
}

let storageClientPromise: Promise<GcsStorageClient> | null = null

async function getStorageClient(): Promise<GcsStorageClient> {
  if (!storageClientPromise) {
    storageClientPromise = (async () => {
      const mod = await import('@google-cloud/storage')
      const Storage = mod.Storage ?? (mod as unknown as { default: typeof mod }).default.Storage
      return new Storage() as unknown as GcsStorageClient
    })()
  }

  return storageClientPromise
}

export class GcsObjectStorage implements ObjectStorage {
  constructor(
    private readonly publicBucketName: string = env.GCS_BUCKET_NAME,
    private readonly privateBucketName: string = env.GCS_REFERENCES_BUCKET_NAME,
  ) {}

  private bucketNameFor(path: string): string {
    return path.startsWith('references/') ? this.privateBucketName : this.publicBucketName
  }

  async upload(input: UploadObjectInput): Promise<void> {
    const client = await getStorageClient()
    const file = client.bucket(this.bucketNameFor(input.path)).file(input.path)

    await file.save(input.data, { contentType: input.contentType, resumable: false })
  }

  async getSignedReadUrl(path: string, expiresInSeconds: number): Promise<string> {
    const client = await getStorageClient()
    const file = client.bucket(this.bucketNameFor(path)).file(path)

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    })

    return url
  }

  async delete(path: string): Promise<void> {
    const client = await getStorageClient()
    const file = client.bucket(this.bucketNameFor(path)).file(path)

    await file.delete()
  }
}

export const objectStorage: ObjectStorage = new GcsObjectStorage()
