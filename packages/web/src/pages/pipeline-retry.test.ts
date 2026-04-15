import { describe, it, expect } from 'vitest'
import { decidePipelineRetry } from './pipeline-retry'
import type { Story } from '../lib/api'

function mkStory(overrides: Partial<Pick<Story, 'seed' | 'plan_final'>> = {}): Pick<Story, 'seed' | 'plan_final'> {
  return { seed: 'a brave bunny', plan_final: null, ...overrides }
}

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
