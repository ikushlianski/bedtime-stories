import type { PsychologistOutput, RunSnapshot } from '../lib/api'

export type ReviewPhase = 'plan' | 'text'

export type ReviewSnapshotState =
  | { kind: 'loading' }
  | { kind: 'ready'; psychOutput: PsychologistOutput }
  | { kind: 'missing'; reason: 'empty' | 'error'; message: string }

export interface SnapshotFetchParams {
  loading: boolean
  error: Error | null
  snapshot: RunSnapshot | null
  phase: ReviewPhase
}

const EMPTY_MESSAGES: Record<ReviewPhase, string> = {
  plan: 'No psychologist assessment was produced for this plan. You can still review and approve the plan below.',
  text: 'No psychologist assessment was produced for this text. You can still review and approve the final text below.',
}

function psychOutputForPhase(snapshot: RunSnapshot, phase: ReviewPhase): PsychologistOutput | null {
  return phase === 'plan' ? snapshot.psychologist_plan_output : snapshot.psychologist_text_output
}

export function deriveReviewSnapshotState(params: SnapshotFetchParams): ReviewSnapshotState {
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

  if (params.snapshot === null) {
    return { kind: 'missing', reason: 'empty', message: EMPTY_MESSAGES[params.phase] }
  }

  const psychOutput = psychOutputForPhase(params.snapshot, params.phase)

  if (psychOutput === null) {
    return { kind: 'missing', reason: 'empty', message: EMPTY_MESSAGES[params.phase] }
  }

  return { kind: 'ready', psychOutput }
}
