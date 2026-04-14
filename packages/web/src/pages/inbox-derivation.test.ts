import { describe, it, expect } from 'vitest'
import {
  deriveInboxAction,
  buildInbox,
  groupInboxByAction,
  actionLabel,
  actionHref,
} from './inbox-derivation'
import type { Story } from '../lib/api'

function mkStory(overrides: Partial<Story>): Story {
  return {
    id: 1,
    title: 'A tale',
    text_final: null,
    plan_v1: null,
    plan_final: null,
    plan_iterations: 1,
    text_v1: null,
    text_v2: null,
    plotter_model: null,
    plotter_prompt_version: null,
    plot_critic_model: null,
    plot_critic_prompt_version: null,
    writer_model: null,
    writer_prompt_version: null,
    writer_critic_model: null,
    writer_critic_prompt_version: null,
    created_at: '2026-04-15T10:00:00Z',
    status: 'draft',
    tags: null,
    source: 'agent',
    is_legacy: false,
    discussion_questions: null,
    ...overrides,
  }
}

describe('deriveInboxAction', () => {
  it('returns pending_plan when the plan has not been produced yet', () => {
    expect(deriveInboxAction(mkStory({ status: 'draft' }))).toBe('pending_plan')
  })

  it('returns review_plan when the plan is ready but text phase has not run', () => {
    expect(
      deriveInboxAction(mkStory({ status: 'draft', plan_final: 'final plan' })),
    ).toBe('review_plan')
  })

  it('returns review_text when text_v2 is set but user has not approved it yet', () => {
    expect(
      deriveInboxAction(
        mkStory({ status: 'draft', plan_final: 'plan', text_v2: 'final text' }),
      ),
    ).toBe('review_text')
  })

  it('returns read_to_sasha once text_final is set', () => {
    expect(
      deriveInboxAction(
        mkStory({
          status: 'ready',
          plan_final: 'plan',
          text_v2: 'text',
          text_final: 'final',
        }),
      ),
    ).toBe('read_to_sasha')
  })

  it('returns leave_feedback when status is read', () => {
    expect(
      deriveInboxAction(
        mkStory({ status: 'read', plan_final: 'plan', text_v2: 't', text_final: 'final' }),
      ),
    ).toBe('leave_feedback')
  })

  it('returns archived when the story has been archived regardless of text state', () => {
    expect(
      deriveInboxAction(
        mkStory({ status: 'archived', plan_final: 'plan', text_v2: 't', text_final: 'final' }),
      ),
    ).toBe('archived')
  })
})

describe('buildInbox', () => {
  it('orders items so actionable tasks appear before waiting and archived ones', () => {
    const stories = [
      mkStory({ id: 1, status: 'archived' }),
      mkStory({ id: 2, status: 'draft' }),
      mkStory({ id: 3, status: 'draft', plan_final: 'p', text_v2: 't' }),
      mkStory({ id: 4, status: 'draft', plan_final: 'p' }),
      mkStory({ id: 5, status: 'ready', plan_final: 'p', text_v2: 't', text_final: 'f' }),
      mkStory({ id: 6, status: 'read', plan_final: 'p', text_v2: 't', text_final: 'f' }),
    ]

    const ordered = buildInbox(stories).map((item) => item.story.id)

    expect(ordered).toEqual([4, 3, 5, 2, 6, 1])
  })

  it('breaks ties within an action by newest created_at first', () => {
    const older = mkStory({
      id: 1,
      created_at: '2026-04-14T10:00:00Z',
      plan_final: 'p',
    })
    const newer = mkStory({
      id: 2,
      created_at: '2026-04-15T10:00:00Z',
      plan_final: 'p',
    })

    const ordered = buildInbox([older, newer]).map((item) => item.story.id)

    expect(ordered).toEqual([2, 1])
  })
})

describe('groupInboxByAction', () => {
  it('groups inbox items by their derived action', () => {
    const items = buildInbox([
      mkStory({ id: 1, status: 'draft', plan_final: 'p' }),
      mkStory({ id: 2, status: 'draft', plan_final: 'p' }),
      mkStory({ id: 3, status: 'draft' }),
    ])

    const groups = groupInboxByAction(items)

    expect(groups.review_plan?.map((i) => i.story.id).sort()).toEqual([1, 2])
    expect(groups.pending_plan?.map((i) => i.story.id)).toEqual([3])
  })
})

describe('actionLabel and actionHref', () => {
  it('returns a human label for every action kind', () => {
    expect(actionLabel('review_plan')).toBe('Review plan')
    expect(actionLabel('review_text')).toBe('Review final text')
    expect(actionLabel('read_to_sasha')).toBe('Read to Sasha')
    expect(actionLabel('leave_feedback')).toBe('Leave feedback')
    expect(actionLabel('pending_plan')).toBe('Waiting for plan')
    expect(actionLabel('archived')).toBe('Archived')
  })

  it('routes each action to the page that lets the user complete it', () => {
    expect(actionHref('review_plan', 42)).toBe('/stories/42/plan-review')
    expect(actionHref('review_text', 42)).toBe('/stories/42/text-review')
    expect(actionHref('read_to_sasha', 42)).toBe('/stories/42')
    expect(actionHref('leave_feedback', 42)).toBe('/stories/42')
    expect(actionHref('pending_plan', 42)).toBe('/stories/42/pipeline')
  })
})
