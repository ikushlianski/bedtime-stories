import { generateIllustrationAlbum } from '@bedtime/core/story-illustrations/generate-illustration-album'
import { objectStorage } from '../storage/gcs-object-storage'

export function triggerIllustrationAlbum(storyId: number): void {
  void generateIllustrationAlbum(storyId, objectStorage).catch((err) => {
    console.error(`[illustration-album] background generation failed for storyId=${storyId}:`, err)
  })
}
