import { describe, it, expect } from 'vitest'
import { deriveIsAuthorizedUser, deriveIdeaFromMessage } from './telegram-utils.js'

describe('deriveIsAuthorizedUser', () => {
  it('returns true when fromId matches allowedId', () => {
    expect(deriveIsAuthorizedUser(123456, 123456)).toBe(true)
  })

  it('returns false when fromId does not match', () => {
    expect(deriveIsAuthorizedUser(999, 123456)).toBe(false)
  })

  it('returns false when fromId is undefined', () => {
    expect(deriveIsAuthorizedUser(undefined, 123456)).toBe(false)
  })

  it('returns false when allowedId is 0 (unconfigured)', () => {
    expect(deriveIsAuthorizedUser(123456, 0)).toBe(false)
  })
})

describe('deriveIdeaFromMessage', () => {
  it('trims the message text and maps to idea shape', () => {
    const result = deriveIdeaFromMessage('  Гоша нашёл карту  ', 7)

    expect(result).toEqual({
      seedText: 'Гоша нашёл карту',
      topic: 'Telegram',
      rationale: 'Submitted via Telegram bot',
      universeId: 7,
    })
  })

  it('preserves internal whitespace', () => {
    const result = deriveIdeaFromMessage('Гоша и  волшебный   лес', 3)

    expect(result.seedText).toBe('Гоша и  волшебный   лес')
  })

  it('includes the universeId in output', () => {
    expect(deriveIdeaFromMessage('idea', 42).universeId).toBe(42)
  })
})
