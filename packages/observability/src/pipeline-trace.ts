import * as Sentry from '@sentry/node'
import { langfuse } from './langfuse-client'
import { getActiveTraceId, withTraceId } from './context'

export async function withPipelineTrace<T>(
  storyId: string,
  fn: (trace: ReturnType<typeof langfuse.trace>) => Promise<T>,
): Promise<T> {
  const trace = langfuse.trace({
    name: 'story-pipeline',
    metadata: { storyId },
  })

  return Sentry.startSpan(
    { name: 'story-pipeline', op: 'ai.pipeline', attributes: { story_id: storyId } },
    () => withTraceId(trace.id, () => fn(trace).finally(() => langfuse.flushAsync())),
  )
}

export async function withPipelineTraceIfNone<T>(storyId: string, fn: () => Promise<T>): Promise<T> {
  if (getActiveTraceId() !== undefined) {
    return fn()
  }

  return withPipelineTrace(storyId, () => fn())
}
