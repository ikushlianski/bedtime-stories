export interface BuildPublicObjectUrlInput {
  bucketName: string
  storagePath: string
}

export function buildPublicObjectUrl(input: BuildPublicObjectUrlInput): string {
  return `https://storage.googleapis.com/${input.bucketName}/${input.storagePath}`
}
