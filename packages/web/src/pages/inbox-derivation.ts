import type { Story } from '../lib/api'

export type InboxAction =
  | 'pending_plan'
  | 'review_plan'
  | 'review_text'
  | 'read_to_sasha'
  | 'leave_feedback'
  | 'archived'

export interface InboxItem {
  story: Story
  action: InboxAction
}

export function deriveInboxAction(story: Story): InboxAction {
  if (story.status === 'archived') return 'archived'
  if (story.status === 'read') return 'leave_feedback'

  if (story.text_final !== null) return 'read_to_sasha'
  if (story.text_v2 !== null) return 'review_text'
  if (story.plan_final !== null) return 'review_plan'

  return 'pending_plan'
}

const ACTION_ORDER: Record<InboxAction, number> = {
  review_plan: 0,
  review_text: 1,
  read_to_sasha: 2,
  pending_plan: 3,
  leave_feedback: 4,
  archived: 5,
}

export function buildInbox(stories: Story[]): InboxItem[] {
  const withActions = stories.map((story) => ({ story, action: deriveInboxAction(story) }))

  return withActions.sort((a, b) => {
    const diff = ACTION_ORDER[a.action] - ACTION_ORDER[b.action]

    if (diff !== 0) return diff

    return b.story.created_at.localeCompare(a.story.created_at)
  })
}

export function groupInboxByAction(items: InboxItem[]): Partial<Record<InboxAction, InboxItem[]>> {
  const groups: Partial<Record<InboxAction, InboxItem[]>> = {}

  for (const item of items) {
    const existing = groups[item.action] ?? []
    existing.push(item)
    groups[item.action] = existing
  }

  return groups
}

export function actionLabel(action: InboxAction): string {
  switch (action) {
    case 'pending_plan':
      return 'Waiting for plan'
    case 'review_plan':
      return 'Review plan'
    case 'review_text':
      return 'Review final text'
    case 'read_to_sasha':
      return 'Read to Sasha'
    case 'leave_feedback':
      return 'Leave feedback'
    case 'archived':
      return 'Archived'
  }
}

export function actionHref(action: InboxAction, storyId: number): string {
  switch (action) {
    case 'review_plan':
      return `/stories/${storyId}/plan-review`
    case 'review_text':
      return `/stories/${storyId}/text-review`
    case 'read_to_sasha':
    case 'leave_feedback':
      return `/stories/${storyId}`
    case 'pending_plan':
      return `/stories/${storyId}/pipeline`
    case 'archived':
      return `/stories/${storyId}`
  }
}
