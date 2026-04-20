import { EventEmitter } from 'node:events'
import type { PipelineInternalStatus } from './pipeline-status'

export type PipelineStreamEvent =
  | { type: 'step'; name: string; status: 'running' | 'done'; summary?: string }
  | { type: 'chunk'; text: string }
  | { type: 'chunk_reset' }
  | { type: 'status'; status: string }

const pipelineStatusMap = new Map<number, PipelineInternalStatus>()
const pipelineCurrentStepMap = new Map<number, string>()
const stepSummaryMap = new Map<number, Map<string, string>>()
const storyEmitters = new Map<number, EventEmitter>()

function getEmitter(storyId: number): EventEmitter {
  if (!storyEmitters.has(storyId)) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(50)
    storyEmitters.set(storyId, emitter)
  }

  return storyEmitters.get(storyId)!
}

let chunkLogCount = 0

export function emitPipelineEvent(storyId: number, event: PipelineStreamEvent): void {
  if (event.type === 'chunk') {
    chunkLogCount++
    if (chunkLogCount <= 3 || chunkLogCount % 50 === 0) {
      console.log(`[sse:emit] storyId=${storyId} chunk #${chunkLogCount} len=${event.text.length}`)
    }
  }

  getEmitter(storyId).emit('event', event)
}

export function subscribePipelineEvents(
  storyId: number,
  handler: (event: PipelineStreamEvent) => void,
): () => void {
  const emitter = getEmitter(storyId)
  emitter.on('event', handler)
  return () => emitter.off('event', handler)
}

export function getPipelineStatus(storyId: number): PipelineInternalStatus | undefined {
  return pipelineStatusMap.get(storyId)
}

export function setPipelineStatus(storyId: number, status: PipelineInternalStatus): void {
  console.log(`[pipeline] storyId=${storyId} status=${status}`)
  pipelineStatusMap.set(storyId, status)
  emitPipelineEvent(storyId, { type: 'status', status })
}

export function getCurrentStep(storyId: number): string | null {
  return pipelineCurrentStepMap.get(storyId) ?? null
}

export function setCurrentStep(storyId: number, step: string): void {
  console.log(`[pipeline] storyId=${storyId} step=${step}`)
  pipelineCurrentStepMap.set(storyId, step)
  emitPipelineEvent(storyId, { type: 'step', name: step, status: 'running' })
}

export function setStepSummary(storyId: number, step: string, summary: string): void {
  if (!stepSummaryMap.has(storyId)) {
    stepSummaryMap.set(storyId, new Map())
  }

  stepSummaryMap.get(storyId)!.set(step, summary)
  emitPipelineEvent(storyId, { type: 'step', name: step, status: 'done', summary })
}

export function getStepSummaries(storyId: number): Map<string, string> {
  return stepSummaryMap.get(storyId) ?? new Map()
}
