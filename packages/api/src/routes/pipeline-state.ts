import type { PipelineInternalStatus } from './pipeline-status'

const pipelineStatusMap = new Map<number, PipelineInternalStatus>()

export function getPipelineStatus(storyId: number): PipelineInternalStatus | undefined {
  return pipelineStatusMap.get(storyId)
}

export function setPipelineStatus(storyId: number, status: PipelineInternalStatus): void {
  pipelineStatusMap.set(storyId, status)
}
