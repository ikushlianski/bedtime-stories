import { describe, it, expect } from 'vitest'
import { toPublicStatus, type PipelineInternalStatus } from './pipeline'

describe('toPublicStatus', () => {
  describe('when the pipeline has never started (undefined)', () => {
    it('returns pending with no phase', () => {
      expect(toPublicStatus(undefined)).toEqual({ status: 'pending', phase: null })
    })
  })

  describe('plan phase states', () => {
    it('maps plan_running to plan_running in the plan phase', () => {
      expect(toPublicStatus('plan_running')).toEqual({ status: 'plan_running', phase: 'plan' })
    })

    it('maps plan_ready to plan_ready in the plan phase', () => {
      expect(toPublicStatus('plan_ready')).toEqual({ status: 'plan_ready', phase: 'plan' })
    })

    it('maps plan_failed to failed and retains the plan phase', () => {
      expect(toPublicStatus('plan_failed')).toEqual({ status: 'failed', phase: 'plan' })
    })
  })

  describe('text phase states', () => {
    it('maps text_running to text_running in the text phase', () => {
      expect(toPublicStatus('text_running')).toEqual({ status: 'text_running', phase: 'text' })
    })

    it('maps text_ready to text_ready in the text phase', () => {
      expect(toPublicStatus('text_ready')).toEqual({ status: 'text_ready', phase: 'text' })
    })

    it('maps text_failed to failed and retains the text phase', () => {
      expect(toPublicStatus('text_failed')).toEqual({ status: 'failed', phase: 'text' })
    })
  })

  describe('exhaustiveness', () => {
    it('handles every defined internal status', () => {
      const allStates: PipelineInternalStatus[] = [
        'plan_running',
        'plan_ready',
        'plan_failed',
        'text_running',
        'text_ready',
        'text_failed',
      ]

      for (const state of allStates) {
        const result = toPublicStatus(state)
        expect(result.status).toBeDefined()
        expect(['plan', 'text']).toContain(result.phase)
      }
    })
  })
})
