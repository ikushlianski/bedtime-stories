import type { PipelineStatusValue, Story } from '../lib/api'

export type RetryDecision =
  | { action: 'hidden' }
  | { action: 'regenerate'; seed: string }
  | { action: 'retry_plan'; seed: string; reason: 'pending' | 'plan_failed' }
  | { action: 'retry_text'; reason: 'text_failed' }
  | { action: 'blocked'; reason: 'missing_seed' }

export const STALL_THRESHOLD_MS = 60 * 60 * 1000

export function isStoryStalled(
  story: Pick<Story, 'created_at' | 'plan_v1' | 'text_v1'>,
  now: Date,
): boolean {
  if (story.plan_v1 != null || story.text_v1 != null) return false

  const createdMs = new Date(story.created_at).getTime()

  if (Number.isNaN(createdMs)) return false

  return now.getTime() - createdMs >= STALL_THRESHOLD_MS
}

export function decidePipelineRetry(
  status: PipelineStatusValue,
  story: Pick<Story, 'seed' | 'plan_final' | 'mode' | 'created_at' | 'plan_v1' | 'text_v1'> | null,
  now: Date = new Date(),
): RetryDecision {
  if (story === null) return { action: 'hidden' }

  if (isStoryStalled(story, now)) {
    if (story.seed === null || story.seed.length === 0) {
      return { action: 'blocked', reason: 'missing_seed' }
    }

    return { action: 'regenerate', seed: story.seed }
  }

  if (
    status === 'plan_running' ||
    status === 'plan_ready' ||
    status === 'text_running' ||
    status === 'text_ready' ||
    status === 'questions_pending' ||
    status === 'questions_answered' ||
    status === 'questions_failed'
  ) {
    return { action: 'hidden' }
  }

  if (status === 'pending' && story.mode === 'auto') {
    return { action: 'hidden' }
  }

  const needsPlanRetry = status === 'pending' || (status === 'failed' && story.plan_final === null)
  const needsTextRetry = status === 'failed' && story.plan_final !== null

  if (needsPlanRetry) {
    if (story.seed === null || story.seed.length === 0) {
      return { action: 'blocked', reason: 'missing_seed' }
    }

    return {
      action: 'retry_plan',
      seed: story.seed,
      reason: status === 'pending' ? 'pending' : 'plan_failed',
    }
  }

  if (needsTextRetry) {
    return { action: 'retry_text', reason: 'text_failed' }
  }

  return { action: 'hidden' }
}
