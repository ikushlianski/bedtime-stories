export type PipelineInternalStatus =
  | 'questions_pending'
  | 'questions_answered'
  | 'questions_failed'
  | 'plan_running'
  | 'plan_ready'
  | 'plan_failed'
  | 'text_running'
  | 'text_ready'
  | 'text_review'
  | 'text_failed'

export interface PublicPipelineStatus {
  status: 'questions_pending' | 'questions_answered' | 'questions_failed' | 'plan_running' | 'plan_ready' | 'text_running' | 'text_ready' | 'text_review' | 'failed' | 'pending'
  phase: 'plan' | 'text' | null
}

export function toPublicStatus(internal: PipelineInternalStatus | undefined): PublicPipelineStatus {
  switch (internal) {
    case 'questions_pending':
      return { status: 'questions_pending', phase: 'plan' }
    case 'questions_answered':
      return { status: 'questions_answered', phase: 'plan' }
    case 'questions_failed':
      return { status: 'questions_failed', phase: null }
    case 'plan_running':
      return { status: 'plan_running', phase: 'plan' }
    case 'plan_ready':
      return { status: 'plan_ready', phase: 'plan' }
    case 'plan_failed':
      return { status: 'failed', phase: 'plan' }
    case 'text_running':
      return { status: 'text_running', phase: 'text' }
    case 'text_ready':
      return { status: 'text_ready', phase: 'text' }
    case 'text_review':
      return { status: 'text_review', phase: 'text' }
    case 'text_failed':
      return { status: 'failed', phase: 'text' }
    default:
      return { status: 'pending', phase: null }
  }
}
