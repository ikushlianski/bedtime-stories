import type { PsychologistOutput, RunSnapshot } from '../lib/api'

export type PlanReviewSnapshotState =
  | { kind: 'loading' }
  | { kind: 'ready'; psychOutput: PsychologistOutput }
  | { kind: 'missing'; reason: 'empty' | 'error'; message: string }

export interface SnapshotFetchParams {
  loading: boolean
  error: Error | null
  snapshot: RunSnapshot | null
}

export function derivePlanReviewSnapshotState(params: SnapshotFetchParams): PlanReviewSnapshotState {
  if (params.loading) {
    return { kind: 'loading' }
  }

  if (params.error !== null) {
    return {
      kind: 'missing',
      reason: 'error',
      message: params.error.message.length > 0 ? params.error.message : 'Failed to load psychologist assessment',
    }
  }

  if (params.snapshot === null || params.snapshot.psychologist_plan_output === null) {
    return {
      kind: 'missing',
      reason: 'empty',
      message: 'No psychologist assessment was produced for this plan. You can still review and approve the plan below.',
    }
  }

  return { kind: 'ready', psychOutput: params.snapshot.psychologist_plan_output }
}
