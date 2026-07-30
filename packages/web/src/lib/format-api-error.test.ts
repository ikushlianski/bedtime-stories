import { describe, it, expect } from 'vitest'
import { formatApiError } from './format-api-error'

describe('formatApiError', () => {
  describe('when the backend returned a structured error body', () => {
    it('uses the body.error field when present, without a technical prefix', () => {
      const message = formatApiError({ error: 'Plan has not been generated yet; cannot approve' })

      expect(message).toBe('Plan has not been generated yet; cannot approve')
    })

    it('uses the body.message field when body.error is missing', () => {
      const message = formatApiError({ message: 'Invalid agent name' })

      expect(message).toBe('Invalid agent name')
    })

    it('prefers body.error over body.message when both exist', () => {
      const message = formatApiError({ error: 'specific reason', message: 'generic message' })

      expect(message).toBe('specific reason')
    })
  })

  describe('when the body is empty or unusable', () => {
    it('falls back to a friendly generic message when body is null', () => {
      expect(formatApiError(null)).toBe('Что-то пошло не так. Попробуй ещё раз через пару минут.')
    })

    it('falls back to a friendly generic message when body is a string (wasn\'t JSON)', () => {
      expect(formatApiError('Oops')).toBe('Что-то пошло не так. Попробуй ещё раз через пару минут.')
    })

    it('falls back to a friendly generic message when body.error is an empty string', () => {
      expect(formatApiError({ error: '' })).toBe('Что-то пошло не так. Попробуй ещё раз через пару минут.')
    })
  })

  describe('defensive inputs', () => {
    it('ignores non-string error fields', () => {
      expect(formatApiError({ error: 123 })).toBe('Что-то пошло не так. Попробуй ещё раз через пару минут.')
    })

    it('does not throw on unexpected body shapes', () => {
      expect(() => formatApiError({ nested: { error: 'deep' } })).not.toThrow()
    })
  })
})
