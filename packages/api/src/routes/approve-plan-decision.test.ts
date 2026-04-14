import { describe, it, expect } from 'vitest'
import { decideApprovePlan, type ApprovePlanStoryState } from './approve-plan-decision'

const baseStory: ApprovePlanStoryState = {
  planFinal: 'final plan text',
  seed: 'a brave bunny',
  textV2: null,
}

describe('decideApprovePlan', () => {
  describe('when the plan has not been generated yet', () => {
    it('rejects with 409 plan_missing', () => {
      const decision = decideApprovePlan({ ...baseStory, planFinal: null }, undefined)

      expect(decision).toEqual({ action: 'reject', httpStatus: 409, reason: 'plan_missing' })
    })

    it('treats an empty plan string as missing', () => {
      const decision = decideApprovePlan({ ...baseStory, planFinal: '' }, undefined)

      expect(decision.action).toBe('reject')
    })
  })

  describe('when the seed is missing', () => {
    it('rejects with 409 seed_missing', () => {
      const decision = decideApprovePlan({ ...baseStory, seed: null }, undefined)

      expect(decision).toEqual({ action: 'reject', httpStatus: 409, reason: 'seed_missing' })
    })
  })

  describe('when the text phase has already completed (db is authoritative)', () => {
    it('skips re-triggering even if the in-memory status map is empty after a server restart', () => {
      const decision = decideApprovePlan(
        { ...baseStory, textV2: 'fully written story' },
        undefined,
      )

      expect(decision).toEqual({ action: 'skip_already_complete' })
    })

    it('still skips when the in-memory map has a stale failed marker', () => {
      const decision = decideApprovePlan(
        { ...baseStory, textV2: 'fully written story' },
        'text_failed',
      )

      expect(decision).toEqual({ action: 'skip_already_complete' })
    })
  })

  describe('when the text phase is already running or ready in memory', () => {
    it('skips because text phase is in progress', () => {
      const decision = decideApprovePlan(baseStory, 'text_running')

      expect(decision).toEqual({ action: 'skip_already_running' })
    })

    it('skips because text phase is flagged ready in memory but persistence race means db has no textV2 yet', () => {
      const decision = decideApprovePlan(baseStory, 'text_ready')

      expect(decision).toEqual({ action: 'skip_already_running' })
    })
  })

  describe('when the text phase previously failed', () => {
    it('allows restart so the user can recover from a transient failure', () => {
      const decision = decideApprovePlan(baseStory, 'text_failed')

      expect(decision.action).toBe('start_text_phase')
    })
  })

  describe('when the plan is ready and no text phase has run yet', () => {
    it('starts the text phase with the existing plan and seed', () => {
      const decision = decideApprovePlan(baseStory, 'plan_ready')

      expect(decision).toEqual({
        action: 'start_text_phase',
        seed: 'a brave bunny',
        planFinal: 'final plan text',
      })
    })

    it('starts the text phase when in-memory status is undefined (after server restart)', () => {
      const decision = decideApprovePlan(baseStory, undefined)

      expect(decision.action).toBe('start_text_phase')
    })
  })
})
