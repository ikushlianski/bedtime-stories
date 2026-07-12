import { describe, it, expect } from 'vitest'
import { decidePipelineRetry, isStoryStalled } from './pipeline-retry'
import type { Story } from '../lib/api'

type StoryFields = Pick<Story, 'seed' | 'plan_final' | 'mode' | 'created_at' | 'plan_v1' | 'text_v1'>

function mkStory(overrides: Partial<StoryFields> = {}): StoryFields {
  return {
    seed: 'a brave bunny',
    plan_final: null,
    mode: 'manual',
    created_at: new Date().toISOString(),
    plan_v1: null,
    text_v1: null,
    ...overrides,
  }
}

const NOW = new Date('2026-07-12T12:00:00Z')
const TWO_HOURS_AGO = new Date('2026-07-12T10:00:00Z').toISOString()
const TEN_MINUTES_AGO = new Date('2026-07-12T11:50:00Z').toISOString()

describe('decidePipelineRetry', () => {
  describe('when the story has not loaded yet', () => {
    it('hides the button so it doesn\'t flash during initial load', () => {
      expect(decidePipelineRetry('pending', null)).toEqual({ action: 'hidden' })
    })
  })

  describe('when the pipeline is actively running or done', () => {
    it('hides the button during plan_running', () => {
      expect(decidePipelineRetry('plan_running', mkStory()).action).toBe('hidden')
    })

    it('hides the button during text_running', () => {
      expect(decidePipelineRetry('text_running', mkStory()).action).toBe('hidden')
    })

    it('hides the button when plan is ready for review', () => {
      expect(decidePipelineRetry('plan_ready', mkStory({ plan_final: 'p' })).action).toBe('hidden')
    })

    it('hides the button when text is ready for review', () => {
      expect(decidePipelineRetry('text_ready', mkStory({ plan_final: 'p' })).action).toBe('hidden')
    })
  })

  describe('when the pipeline is stuck in the zombie "pending" state', () => {
    it('offers a plan-phase retry with the existing seed so the user can unblock a draft that never ran', () => {
      const decision = decidePipelineRetry('pending', mkStory({ seed: 'a brave bunny' }))

      expect(decision).toEqual({ action: 'retry_plan', seed: 'a brave bunny', reason: 'pending' })
    })

    it('blocks the retry when the seed is missing so we don\'t start a pipeline with no input', () => {
      expect(decidePipelineRetry('pending', mkStory({ seed: null }))).toEqual({
        action: 'blocked',
        reason: 'missing_seed',
      })
    })

    it('hides the retry button for auto stories — the auto trigger handles kickoff, the manual button would 409', () => {
      expect(decidePipelineRetry('pending', mkStory({ mode: 'auto' }))).toEqual({ action: 'hidden' })
    })
  })

  describe('when a story is stalled (over an hour old with no plotter or writer activity)', () => {
    it('offers regeneration even for an auto story that the auto trigger silently dropped', () => {
      const decision = decidePipelineRetry('pending', mkStory({ mode: 'auto', created_at: TWO_HOURS_AGO }), NOW)

      expect(decision).toEqual({ action: 'regenerate', seed: 'a brave bunny' })
    })

    it('offers regeneration even if the zombie status still claims plan_running', () => {
      const decision = decidePipelineRetry('plan_running', mkStory({ created_at: TWO_HOURS_AGO }), NOW)

      expect(decision.action).toBe('regenerate')
    })

    it('blocks regeneration when the seed is missing', () => {
      const decision = decidePipelineRetry('pending', mkStory({ seed: null, created_at: TWO_HOURS_AGO }), NOW)

      expect(decision).toEqual({ action: 'blocked', reason: 'missing_seed' })
    })

    it('does not treat a recent story as stalled', () => {
      const decision = decidePipelineRetry('plan_running', mkStory({ created_at: TEN_MINUTES_AGO }), NOW)

      expect(decision.action).toBe('hidden')
    })

    it('does not treat a story with a plan or text as stalled, even if old', () => {
      expect(isStoryStalled({ created_at: TWO_HOURS_AGO, plan_v1: 'a plan', text_v1: null }, NOW)).toBe(false)
      expect(isStoryStalled({ created_at: TWO_HOURS_AGO, plan_v1: null, text_v1: 'some text' }, NOW)).toBe(false)
    })
  })

  describe('when the pipeline explicitly failed', () => {
    it('offers a plan retry when the failure was during plan phase (no plan_final)', () => {
      const decision = decidePipelineRetry('failed', mkStory({ plan_final: null }))

      expect(decision.action).toBe('retry_plan')
      if (decision.action === 'retry_plan') expect(decision.reason).toBe('plan_failed')
    })

    it('offers a text retry when the failure was during text phase (plan_final already exists)', () => {
      const decision = decidePipelineRetry('failed', mkStory({ plan_final: 'already-approved' }))

      expect(decision).toEqual({ action: 'retry_text', reason: 'text_failed' })
    })
  })
})
