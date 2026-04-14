export type PipelineInternalStatus =
  | 'plan_running'
  | 'plan_ready'
  | 'plan_failed'
  | 'text_running'
  | 'text_ready'
  | 'text_failed'

export interface PublicPipelineStatus {
  status: 'plan_running' | 'plan_ready' | 'text_running' | 'text_ready' | 'failed' | 'pending'
  phase: 'plan' | 'text' | null
}

export function toPublicStatus(internal: PipelineInternalStatus | undefined): PublicPipelineStatus {
  switch (internal) {
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
