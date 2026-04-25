import * as Sentry from '@sentry/node'
import { langfuse } from './langfuse-client'

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
    () => fn(trace).finally(() => langfuse.flushAsync()),
  )
}
