import type { PipelineInternalStatus } from './pipeline-status'

const pipelineStatusMap = new Map<number, PipelineInternalStatus>()
const pipelineCurrentStepMap = new Map<number, string>()

export function getPipelineStatus(storyId: number): PipelineInternalStatus | undefined {
  return pipelineStatusMap.get(storyId)
}

export function setPipelineStatus(storyId: number, status: PipelineInternalStatus): void {
  console.log(`[pipeline] storyId=${storyId} status=${status}`)
  pipelineStatusMap.set(storyId, status)
}

export function getCurrentStep(storyId: number): string | null {
  return pipelineCurrentStepMap.get(storyId) ?? null
}

export function setCurrentStep(storyId: number, step: string): void {
  console.log(`[pipeline] storyId=${storyId} step=${step}`)
  pipelineCurrentStepMap.set(storyId, step)
}
