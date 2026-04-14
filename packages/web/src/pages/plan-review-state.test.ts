import { describe, it, expect } from 'vitest'
import { derivePlanReviewSnapshotState } from './plan-review-state'
import type { PsychologistOutput, RunSnapshot } from '../lib/api'

const safePsych: PsychologistOutput = {
  safety: { verdict: 'safe', issues: [] },
  therapeutic: { score: 4, strengths: ['warmth'], gaps: [] },
  recommended_changes: [],
}

const fullSnapshot: RunSnapshot = {
  story_id: 1,
  psychologist_plan_output: safePsych,
  psychologist_text_output: null,
  plot_critic_output: null,
  writer_critic_output: null,
  plan_iterations_count: 2,
}

describe('derivePlanReviewSnapshotState', () => {
  describe('while the fetch is in flight', () => {
    it('returns loading regardless of stale snapshot or error values', () => {
      expect(
        derivePlanReviewSnapshotState({ loading: true, error: null, snapshot: null }),
      ).toEqual({ kind: 'loading' })

      expect(
        derivePlanReviewSnapshotState({ loading: true, error: new Error('stale'), snapshot: null }),
      ).toEqual({ kind: 'loading' })
    })
  })

  describe('when the fetch failed (network, 404, 500)', () => {
    it('returns missing with reason=error and the thrown message', () => {
      const state = derivePlanReviewSnapshotState({
        loading: false,
        error: new Error('API error 404: Not Found'),
        snapshot: null,
      })

      expect(state).toEqual({
        kind: 'missing',
        reason: 'error',
        message: 'API error 404: Not Found',
      })
    })

    it('falls back to a default message when the error has no useful message', () => {
      const state = derivePlanReviewSnapshotState({
        loading: false,
        error: new Error(''),
        snapshot: null,
      })

      expect(state.kind).toBe('missing')
      if (state.kind === 'missing') {
        expect(state.reason).toBe('error')
        expect(state.message.length).toBeGreaterThan(0)
      }
    })
  })

  describe('when the snapshot endpoint returned no psychologist output', () => {
    it('returns missing with reason=empty when the snapshot itself is null', () => {
      const state = derivePlanReviewSnapshotState({
        loading: false,
        error: null,
        snapshot: null,
      })

      expect(state.kind).toBe('missing')
      if (state.kind === 'missing') expect(state.reason).toBe('empty')
    })

    it('returns missing with reason=empty when psychologist_plan_output is null', () => {
      const state = derivePlanReviewSnapshotState({
        loading: false,
        error: null,
        snapshot: { ...fullSnapshot, psychologist_plan_output: null },
      })

      expect(state.kind).toBe('missing')
      if (state.kind === 'missing') expect(state.reason).toBe('empty')
    })
  })

  describe('when the psychologist output is available', () => {
    it('returns ready with the psychologist output', () => {
      const state = derivePlanReviewSnapshotState({
        loading: false,
        error: null,
        snapshot: fullSnapshot,
      })

      expect(state).toEqual({ kind: 'ready', psychOutput: safePsych })
    })
  })
})
