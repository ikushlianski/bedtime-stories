export type PipelineInternalStatus =
  | 'questions_pending'
  | 'questions_answered'
  | 'plan_running'
  | 'plan_ready'
  | 'plan_failed'
  | 'text_running'
  | 'text_ready'
  | 'text_failed'

export interface PublicPipelineStatus {
  status: 'questions_pending' | 'plan_running' | 'plan_ready' | 'text_running' | 'text_ready' | 'failed' | 'pending'
  phase: 'plan' | 'text' | null
}

export function toPublicStatus(internal: PipelineInternalStatus | undefined): PublicPipelineStatus {
  switch (internal) {
    case 'questions_pending':
      return { status: 'questions_pending', phase: 'plan' }
    case 'questions_answered':
      return { status: 'plan_running', phase: 'plan' }
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
    case 'text_failed':
      return { status: 'failed', phase: 'text' }
    default:
      return { status: 'pending', phase: null }
  }
}
