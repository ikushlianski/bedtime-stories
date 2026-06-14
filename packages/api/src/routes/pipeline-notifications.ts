export type StoryNotificationStage = 'generated' | 'approved'

type StoryReadyCallback = (storyId: number, stage: StoryNotificationStage) => void

let storyReadyCallback: StoryReadyCallback | null = null

export function registerStoryReadyCallback(fn: StoryReadyCallback): void {
  storyReadyCallback = fn
}

export function notifyStoryReady(storyId: number, stage: StoryNotificationStage = 'approved'): void {
  if (storyReadyCallback) {
    storyReadyCallback(storyId, stage)
  }
}
