import type { PipelineInternalStatus } from './pipeline-status'

export interface ApprovePlanStoryState {
  planV1: string | null
  planFinal: string | null
  seed: string | null
  textV2: string | null
}

export type ApprovePlanDecision =
  | { action: 'start_text_phase'; seed: string; planV1: string }
  | { action: 'skip_already_running' }
  | { action: 'skip_already_complete' }
  | { action: 'reject'; httpStatus: 409; reason: 'plan_missing' | 'seed_missing' }

export function decideApprovePlan(
  story: ApprovePlanStoryState,
  inMemoryStatus: PipelineInternalStatus | undefined,
): ApprovePlanDecision {
  const effectivePlan = story.planV1 ?? story.planFinal

  if (effectivePlan === null || effectivePlan.length === 0) {
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

  return { action: 'start_text_phase', seed: story.seed, planV1: effectivePlan }
}
