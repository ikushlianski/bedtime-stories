import { describe, it, expect } from 'vitest'
import { isDiaryDraftValid, DIARY_CONTENT_MAX_LENGTH } from './diary'

describe('isDiaryDraftValid', () => {
  it('rejects an empty draft', () => {
    expect(isDiaryDraftValid('')).toBe(false)
  })

  it('rejects a whitespace-only draft', () => {
    expect(isDiaryDraftValid('   \n\t  ')).toBe(false)
  })

  it('accepts a normal draft', () => {
    expect(isDiaryDraftValid('Сегодня Саша заинтересовался динозаврами')).toBe(true)
  })

  it('accepts a draft whose trimmed length is exactly DIARY_CONTENT_MAX_LENGTH', () => {
    const draft = 'a'.repeat(DIARY_CONTENT_MAX_LENGTH)

    expect(isDiaryDraftValid(draft)).toBe(true)
  })

  it('rejects a draft whose trimmed length exceeds DIARY_CONTENT_MAX_LENGTH by one', () => {
    const draft = 'a'.repeat(DIARY_CONTENT_MAX_LENGTH + 1)

    expect(isDiaryDraftValid(draft)).toBe(false)
  })
})
