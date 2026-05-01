import { AsyncLocalStorage } from 'node:async_hooks'
import { Sentry } from './sentry-node'

const traceIdStorage = new AsyncLocalStorage<string>()

export function withTraceId<T>(traceId: string, fn: () => Promise<T>): Promise<T> {
  return traceIdStorage.run(traceId, fn)
}

export function getActiveTraceId(): string | undefined {
  return traceIdStorage.getStore()
}

export function addStoryContext(ctx: {
  storyId?: string
  stage?: string
  childProfileId?: string
}) {
  Sentry.setTags({
    ...(ctx.storyId !== undefined && { story_id: ctx.storyId }),
    ...(ctx.stage !== undefined && { pipeline_stage: ctx.stage }),
    ...(ctx.childProfileId !== undefined && { child_profile_id: ctx.childProfileId }),
  })
}
