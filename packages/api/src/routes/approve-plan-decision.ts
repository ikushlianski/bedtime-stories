import type { PipelineInternalStatus } from './pipeline-status'

export interface ApprovePlanStoryState {
  planFinal: string | null
  seed: string | null
  textV2: string | null
}

export type ApprovePlanDecision =
  | { action: 'start_text_phase'; seed: string; planFinal: string }
  | { action: 'skip_already_running' }
  | { action: 'skip_already_complete' }
  | { action: 'reject'; httpStatus: 409; reason: 'plan_missing' | 'seed_missing' }

export function decideApprovePlan(
  story: ApprovePlanStoryState,
  inMemoryStatus: PipelineInternalStatus | undefined,
): ApprovePlanDecision {
  if (story.planFinal === null || story.planFinal.length === 0) {
    return { action: 'reject', httpStatus: 409, reason: 'plan_missing' }
  }

  if (story.seed === null || story.seed.length === 0) {
    return { action: 'reject', httpStatus: 409, reason: 'seed_missing' }
  }

  if (story.textV2 !== null && story.textV2.length > 0) {
    return { action: 'skip_already_complete' }
  }

  if (inMemoryStatus === 'text_running' || inMemoryStatus === 'text_ready') {
    return { action: 'skip_already_running' }
  }

  return { action: 'start_text_phase', seed: story.seed, planFinal: story.planFinal }
}
