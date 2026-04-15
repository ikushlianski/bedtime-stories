import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  isRetryable,
  extractJsonFromText,
  jsonCandidates,
  parseJsonWithSchema,
  AiValidationError,
} from './claude-cli.runner'

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

describe('jsonCandidates', () => {
  describe('priority ordering', () => {
    it('yields json-labeled fences before plain fences so the model can hint intent', () => {
      const raw = '```\n{"unlabelled": 1}\n```\nand also:\n```json\n{"labelled": 2}\n```'
      const result = [...jsonCandidates(raw)]

      expect(result[0]).toBe('{"labelled": 2}')
      expect(result).toContain('{"unlabelled": 1}')
    })

    it('yields every fenced block so a caller can pick the one that validates against a schema', () => {
      const raw = [
        'For example, a response might look like:',
        '```json',
        '{"kind": "example", "issues": ["stub"]}',
        '```',
        'My actual answer:',
        '```json',
        '{"kind": "answer", "issues": []}',
        '```',
      ].join('\n')

      const result = [...jsonCandidates(raw)]

      expect(result).toEqual(
        expect.arrayContaining(['{"kind": "example", "issues": ["stub"]}', '{"kind": "answer", "issues": []}']),
      )
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('yields the balanced object from raw text when there is no fence', () => {
      const raw = 'Preamble {"safety": "safe"} trailing prose'
      const result = [...jsonCandidates(raw)]

      expect(result).toContain('{"safety": "safe"}')
    })
  })

  describe('balanced brace extraction (no lastIndexOf footgun)', () => {
    it('stops at the first matching closing brace even when more JSON-like content follows', () => {
      const raw = '{"first": 1} {"second": 2}'
      const result = [...jsonCandidates(raw)]

      expect(result[0]).toBe('{"first": 1}')
    })

    it('handles braces inside string literals without breaking nesting', () => {
      const raw = 'Result: {"label": "value with }"}'
      const result = [...jsonCandidates(raw)]

      expect(result[0]).toBe('{"label": "value with }"}')
    })

    it('handles escaped quotes inside string literals', () => {
      const raw = '{"label": "he said \\"hi\\" then"}'
      const result = [...jsonCandidates(raw)]

      expect(result[0]).toBe('{"label": "he said \\"hi\\" then"}')
    })
  })

  describe('unparseable outputs', () => {
    it('still yields the trimmed raw text as a final fallback', () => {
      const raw = '   some prose   '
      const result = [...jsonCandidates(raw)]

      expect(result).toContain('some prose')
    })

    it('yields nothing from an empty string', () => {
      const result = [...jsonCandidates('')]

      expect(result).toEqual([])
    })
  })
})

describe('parseJsonWithSchema', () => {
  const improverLikeSchema = z.object({
    patterns: z.array(z.object({ description: z.string(), evidence_count: z.number() })),
    proposed_changes: z.array(z.object({ agent: z.string(), rationale: z.string() })),
  })

  const validPayload = {
    patterns: [{ description: 'too dry', evidence_count: 3 }],
    proposed_changes: [{ agent: 'writer', rationale: 'add more sensory detail' }],
  }

  it('returns ok=true for a clean json response', () => {
    const raw = JSON.stringify(validPayload)
    const result = parseJsonWithSchema(raw, improverLikeSchema)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual(validPayload)
  })

  it('skips a leading example block that does not match the schema and picks the real answer', () => {
    const exampleBlock = '{"patterns": "not an array, wrong shape"}'
    const realAnswer = JSON.stringify(validPayload)
    const raw = `Example:\n\`\`\`json\n${exampleBlock}\n\`\`\`\n\nMy answer:\n\`\`\`json\n${realAnswer}\n\`\`\``

    const result = parseJsonWithSchema(raw, improverLikeSchema)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual(validPayload)
  })

  it('returns ok=false with the last validation error when no candidate matches the schema', () => {
    const raw = '{"wrong": "shape"}'
    const result = parseJsonWithSchema(raw, improverLikeSchema)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeDefined()
  })

  it('returns ok=false when the text contains no json at all', () => {
    const raw = 'I could not produce a response.'
    const result = parseJsonWithSchema(raw, improverLikeSchema)

    expect(result.ok).toBe(false)
  })
})
