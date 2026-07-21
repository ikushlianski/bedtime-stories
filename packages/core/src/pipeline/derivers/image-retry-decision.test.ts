import { describe, it, expect } from 'vitest'
import { deriveImageRetryDecision } from './image-retry-decision'

describe('deriveImageRetryDecision', () => {
  it('marks the slot ready on success regardless of attempt count', () => {
    const result = deriveImageRetryDecision({ attempt: 1, outcome: 'success' })

    expect(result).toEqual({ shouldRetry: false, nextStatus: 'ready', failureReason: null })
  })

  it('does not retry a moderation refusal', () => {
    const result = deriveImageRetryDecision({ attempt: 1, outcome: 'moderation_refused' })

    expect(result).toEqual({ shouldRetry: false, nextStatus: 'failed', failureReason: 'moderation_refused' })
  })

  it('does not retry a terminal error such as an invalid request or unknown model', () => {
    const result = deriveImageRetryDecision({ attempt: 1, outcome: 'terminal_error' })

    expect(result).toEqual({ shouldRetry: false, nextStatus: 'failed', failureReason: 'api_error' })
  })

  it('retries a retryable failure while under the attempt cap', () => {
    const first = deriveImageRetryDecision({ attempt: 1, outcome: 'retryable' })
    const second = deriveImageRetryDecision({ attempt: 2, outcome: 'retryable' })

    expect(first).toEqual({ shouldRetry: true, nextStatus: 'generating', failureReason: null })
    expect(second).toEqual({ shouldRetry: true, nextStatus: 'generating', failureReason: null })
  })

  it('gives up after 3 total attempts and marks the slot failed with retries_exhausted', () => {
    const result = deriveImageRetryDecision({ attempt: 3, outcome: 'retryable' })

    expect(result).toEqual({ shouldRetry: false, nextStatus: 'failed', failureReason: 'retries_exhausted' })
  })

  it('never retries beyond the cap even if attempt exceeds it', () => {
    const result = deriveImageRetryDecision({ attempt: 4, outcome: 'retryable' })

    expect(result.shouldRetry).toBe(false)
    expect(result.nextStatus).toBe('failed')
  })
})
