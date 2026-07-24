export type ImageGenerationOutcome = 'success' | 'retryable' | 'moderation_refused' | 'terminal_error'

export interface DeriveImageRetryDecisionInput {
  attempt: number
  outcome: ImageGenerationOutcome
}

export interface ImageRetryDecision {
  shouldRetry: boolean
  nextStatus: 'ready' | 'failed' | 'generating'
  failureReason: string | null
}

export const MAX_IMAGE_ATTEMPTS = 3

export function deriveImageRetryDecision(input: DeriveImageRetryDecisionInput): ImageRetryDecision {
  const { attempt, outcome } = input

  if (outcome === 'success') {
    return { shouldRetry: false, nextStatus: 'ready', failureReason: null }
  }

  if (outcome === 'moderation_refused') {
    return { shouldRetry: false, nextStatus: 'failed', failureReason: 'moderation_refused' }
  }

  if (outcome === 'terminal_error') {
    return { shouldRetry: false, nextStatus: 'failed', failureReason: 'api_error' }
  }

  if (attempt < MAX_IMAGE_ATTEMPTS) {
    return { shouldRetry: true, nextStatus: 'generating', failureReason: null }
  }

  return { shouldRetry: false, nextStatus: 'failed', failureReason: 'retries_exhausted' }
}
