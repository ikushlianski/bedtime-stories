type StoryReadyCallback = (storyId: number) => void

let storyReadyCallback: StoryReadyCallback | null = null

export function registerStoryReadyCallback(fn: StoryReadyCallback): void {
  storyReadyCallback = fn
}

export function notifyStoryReady(storyId: number): void {
  if (storyReadyCallback) {
    storyReadyCallback(storyId)
  }
}
