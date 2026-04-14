import { describe, it, expect } from 'vitest'
import { deriveReviewSnapshotState } from './review-snapshot-state'
import type { PsychologistOutput, RunSnapshot } from '../lib/api'

const psychPlan: PsychologistOutput = {
  safety: { verdict: 'safe', issues: [] },
  therapeutic: { score: 4, strengths: ['warmth'], gaps: [] },
  recommended_changes: [],
}

const psychText: PsychologistOutput = {
  safety: { verdict: 'safe', issues: [] },
  therapeutic: { score: 5, strengths: ['resolution'], gaps: [] },
  recommended_changes: [],
}

const snapshotWithBoth: RunSnapshot = {
  story_id: 1,
  psychologist_plan_output: psychPlan,
  psychologist_text_output: psychText,
  plot_critic_output: null,
  writer_critic_output: null,
  plan_iterations_count: 2,
}

describe('deriveReviewSnapshotState', () => {
  describe('phase selection', () => {
    it('returns the plan psychologist output when phase=plan', () => {
      const state = deriveReviewSnapshotState({
        loading: false,
        error: null,
        snapshot: snapshotWithBoth,
        phase: 'plan',
      })

      expect(state).toEqual({ kind: 'ready', psychOutput: psychPlan })
    })

    it('returns the text psychologist output when phase=text', () => {
      const state = deriveReviewSnapshotState({
        loading: false,
        error: null,
        snapshot: snapshotWithBoth,
        phase: 'text',
      })

      expect(state).toEqual({ kind: 'ready', psychOutput: psychText })
    })

    it('treats a snapshot with plan output but no text output as empty for phase=text', () => {
      const state = deriveReviewSnapshotState({
        loading: false,
        error: null,
        snapshot: { ...snapshotWithBoth, psychologist_text_output: null },
        phase: 'text',
      })

      expect(state.kind).toBe('missing')
      if (state.kind === 'missing') expect(state.reason).toBe('empty')
    })

    it('treats a snapshot with text output but no plan output as empty for phase=plan', () => {
      const state = deriveReviewSnapshotState({
        loading: false,
        error: null,
        snapshot: { ...snapshotWithBoth, psychologist_plan_output: null },
        phase: 'plan',
      })

      expect(state.kind).toBe('missing')
      if (state.kind === 'missing') expect(state.reason).toBe('empty')
    })
  })

  describe('loading and error precedence', () => {
    it('returns loading regardless of phase', () => {
      const planLoading = deriveReviewSnapshotState({
        loading: true,
        error: null,
        snapshot: null,
        phase: 'plan',
      })

      const textLoading = deriveReviewSnapshotState({
        loading: true,
        error: null,
        snapshot: null,
        phase: 'text',
      })

      expect(planLoading).toEqual({ kind: 'loading' })
      expect(textLoading).toEqual({ kind: 'loading' })
    })

    it('returns missing with error reason for both phases', () => {
      const err = new Error('API error 500')

      const planErr = deriveReviewSnapshotState({ loading: false, error: err, snapshot: null, phase: 'plan' })
      const textErr = deriveReviewSnapshotState({ loading: false, error: err, snapshot: null, phase: 'text' })

      expect(planErr).toEqual({ kind: 'missing', reason: 'error', message: 'API error 500' })
      expect(textErr).toEqual({ kind: 'missing', reason: 'error', message: 'API error 500' })
    })
  })

  describe('empty messages are phase-specific so the UI explains what is missing', () => {
    it('mentions plan in the plan-phase empty message', () => {
      const state = deriveReviewSnapshotState({
        loading: false,
        error: null,
        snapshot: null,
        phase: 'plan',
      })

      if (state.kind === 'missing') expect(state.message.toLowerCase()).toContain('plan')
    })

    it('mentions text in the text-phase empty message', () => {
      const state = deriveReviewSnapshotState({
        loading: false,
        error: null,
        snapshot: null,
        phase: 'text',
      })

      if (state.kind === 'missing') expect(state.message.toLowerCase()).toContain('text')
    })
  })
})
