import { describe, it, expect } from 'vitest'
import { formatApiError } from './format-api-error'

describe('formatApiError', () => {
  describe('when the backend returned a structured error body', () => {
    it('uses the body.error field when present', () => {
      const message = formatApiError(409, 'Conflict', { error: 'Plan has not been generated yet; cannot approve' })

      expect(message).toBe('API error 409: Plan has not been generated yet; cannot approve')
    })

    it('uses the body.message field when body.error is missing', () => {
      const message = formatApiError(400, 'Bad Request', { message: 'Invalid agent name' })

      expect(message).toBe('API error 400: Invalid agent name')
    })

    it('prefers body.error over body.message when both exist', () => {
      const message = formatApiError(500, 'Internal Server Error', {
        error: 'specific reason',
        message: 'generic message',
      })

      expect(message).toBe('API error 500: specific reason')
    })
  })

  describe('when the body is empty or unusable', () => {
    it('falls back to status text when body is null', () => {
      expect(formatApiError(500, 'Internal Server Error', null)).toBe('API error 500: Internal Server Error')
    })

    it('falls back to status text when body is a string (wasn\'t JSON)', () => {
      expect(formatApiError(500, 'Internal Server Error', 'Oops')).toBe('API error 500: Internal Server Error')
    })

    it('falls back to status text when body.error is an empty string', () => {
      expect(formatApiError(500, 'Internal Server Error', { error: '' })).toBe(
        'API error 500: Internal Server Error',
      )
    })

    it('falls back to just the status code when neither body nor statusText is useful', () => {
      expect(formatApiError(502, '', null)).toBe('API error 502')
    })
  })

  describe('defensive inputs', () => {
    it('ignores non-string error fields', () => {
      expect(formatApiError(400, 'Bad Request', { error: 123 })).toBe('API error 400: Bad Request')
    })

    it('does not throw on unexpected body shapes', () => {
      expect(() => formatApiError(500, 'Internal Server Error', { nested: { error: 'deep' } })).not.toThrow()
    })
  })
})
