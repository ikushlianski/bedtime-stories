export interface UploadObjectInput {
  path: string
  data: Buffer
  contentType: string
}

export interface ObjectStorage {
  upload(input: UploadObjectInput): Promise<void>
  getSignedReadUrl(path: string, expiresInSeconds: number): Promise<string>
  delete(path: string): Promise<void>
}
