export interface BuildStoryIllustrationAssetPathInput {
  storyId: number
  fileId: string
  extension: string
}

export function buildStoryIllustrationAssetPath(input: BuildStoryIllustrationAssetPathInput): string {
  const extension = input.extension.replace(/^\./, '')

  return `illustrations/${input.storyId}/${input.fileId}.${extension}`
}
