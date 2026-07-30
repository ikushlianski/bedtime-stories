export type StoryNotificationStage = 'generated' | 'approved'
export type StoryFailurePhase = 'plan' | 'text'

type StoryReadyCallback = (storyId: number, stage: StoryNotificationStage) => void
type StoryFailedCallback = (storyId: number, phase: StoryFailurePhase) => void

let storyReadyCallback: StoryReadyCallback | null = null
let storyFailedCallback: StoryFailedCallback | null = null

export function registerStoryReadyCallback(fn: StoryReadyCallback): void {
  storyReadyCallback = fn
}

export function registerStoryFailedCallback(fn: StoryFailedCallback): void {
  storyFailedCallback = fn
}

export function notifyStoryReady(storyId: number, stage: StoryNotificationStage = 'approved'): void {
  if (storyReadyCallback) {
    storyReadyCallback(storyId, stage)
  }
}

export function notifyStoryFailed(storyId: number, phase: StoryFailurePhase): void {
  if (storyFailedCallback) {
    storyFailedCallback(storyId, phase)
  }
}
