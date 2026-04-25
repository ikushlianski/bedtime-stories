import { Sentry } from './sentry-node'

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
