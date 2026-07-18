export type StoryStatus = 'draft' | 'proofreading' | 'ready' | 'read' | 'archived'
export type ChatIntent = 'mutate' | 'record'

export interface ResolveChatGateInput {
  storyStatus: StoryStatus
  intent: ChatIntent
}

export type ResolveChatGateResult =
  | { allowed: true }
  | { allowed: false; reason: string; suggestedEndpoint: string }

const FINISHED_STATUSES: readonly StoryStatus[] = ['ready', 'read', 'archived']
const COMMENTS_ENDPOINT = 'POST /api/stories/:id/comments'

export function resolveChatGate({ storyStatus, intent }: ResolveChatGateInput): ResolveChatGateResult {
  const isFinished = FINISHED_STATUSES.includes(storyStatus)

  if (intent === 'mutate') {
    if (isFinished) {
      return {
        allowed: false,
        reason: `Story is ${storyStatus} — its text and plan can no longer be changed. Use ${COMMENTS_ENDPOINT} to leave a comment instead.`,
        suggestedEndpoint: COMMENTS_ENDPOINT,
      }
    }

    return { allowed: true }
  }

  if (!isFinished) {
    return {
      allowed: false,
      reason: `Story is ${storyStatus} — comments can only be recorded once a story is ready, read, or archived. Use the chat endpoint to leave feedback while it is still editable.`,
      suggestedEndpoint: 'POST /api/pipeline/conversations/:storyId',
    }
  }

  return { allowed: true }
}
