import { describe, it, expect } from 'vitest'
import { isRetryable, extractJsonFromText, AiValidationError } from './claude-cli.runner'

describe('isRetryable', () => {
  describe('transient network errors', () => {
    it('returns true for timeout errors', () => {
      expect(isRetryable(new Error('Request timeout after 30s'))).toBe(true)
    })

    it('returns true for ECONNRESET', () => {
      expect(isRetryable(new Error('ECONNRESET: connection reset'))).toBe(true)
    })

    it('returns true for network errors', () => {
      expect(isRetryable(new Error('Network error'))).toBe(true)
    })

    it('returns true for fetch errors', () => {
      expect(isRetryable(new Error('fetch failed'))).toBe(true)
    })

    it('returns true for socket errors', () => {
      expect(isRetryable(new Error('socket hang up'))).toBe(true)
    })
  })

  describe('HTTP status-based transients', () => {
    it('returns true for 503 Service Unavailable', () => {
      expect(isRetryable(new Error('HTTP 503 Service Unavailable'))).toBe(true)
    })

    it('returns true for 504 Gateway Timeout', () => {
      expect(isRetryable(new Error('HTTP 504'))).toBe(true)
    })

    it('returns true for 529 Overloaded (Anthropic)', () => {
      expect(isRetryable(new Error('529 overloaded_error'))).toBe(true)
    })

    it('returns true for rate limit errors', () => {
      expect(isRetryable(new Error('rate_limit_error'))).toBe(true)
    })
  })

  describe('permanent errors that should not retry', () => {
    it('returns false for AiValidationError (bad JSON from model)', () => {
      const err = new AiValidationError('raw text', new Error('parse failed'))
      expect(isRetryable(err)).toBe(false)
    })

    it('returns false for 400 Bad Request', () => {
      expect(isRetryable(new Error('HTTP 400 Bad Request'))).toBe(false)
    })

    it('returns false for authentication errors', () => {
      expect(isRetryable(new Error('invalid API key'))).toBe(false)
    })
  })

  describe('non-Error inputs', () => {
    it('handles string errors by checking the stringified message', () => {
      expect(isRetryable('connection timeout')).toBe(true)
    })

    it('returns false for unrelated strings', () => {
      expect(isRetryable('something else')).toBe(false)
    })
  })
})

describe('extractJsonFromText', () => {
  describe('when the response is wrapped in a fenced code block', () => {
    it('extracts JSON from ```json fence', () => {
      const raw = 'Here is the result:\n```json\n{"foo": 1}\n```\nAnything after'
      expect(extractJsonFromText(raw)).toBe('{"foo": 1}')
    })

    it('extracts JSON from plain ``` fence without language tag', () => {
      const raw = '```\n{"a": "b"}\n```'
      expect(extractJsonFromText(raw)).toBe('{"a": "b"}')
    })
  })

  describe('when the response is raw JSON without fences', () => {
    it('returns the JSON substring from first brace to last brace', () => {
      const raw = 'Analysis: {"patterns": [], "proposed_changes": []}'
      expect(extractJsonFromText(raw)).toBe('{"patterns": [], "proposed_changes": []}')
    })

    it('handles multiline raw JSON', () => {
      const raw = '{\n  "foo": 1,\n  "bar": 2\n}'
      expect(extractJsonFromText(raw)).toBe('{\n  "foo": 1,\n  "bar": 2\n}')
    })
  })

  describe('when there is no JSON detectable', () => {
    it('returns the trimmed raw text as a last resort', () => {
      const raw = '   just some prose   '
      expect(extractJsonFromText(raw)).toBe('just some prose')
    })
  })

  describe('edge cases that still parse', () => {
    it('extracts the outermost object when nested objects exist', () => {
      const raw = '{"outer": {"inner": 1}}'
      expect(extractJsonFromText(raw)).toBe('{"outer": {"inner": 1}}')
    })
  })
})
