import { describe, it, expect } from 'vitest'
import {
  parseStoryIdMessage,
  formatStoriesList,
  statusEmoji,
  storyLabel,
  chunkText,
  pickReadableText,
} from './telegram-format.js'

describe('parseStoryIdMessage', () => {
  it('returns the numeric id for a bare number', () => {
    expect(parseStoryIdMessage('69')).toBe(69)
  })

  it('trims surrounding whitespace', () => {
    expect(parseStoryIdMessage('  12  ')).toBe(12)
  })

  it('returns null for non-numeric story ideas', () => {
    expect(parseStoryIdMessage('Гоша нашёл карту')).toBeNull()
  })

  it('returns null for mixed text that merely contains a number', () => {
    expect(parseStoryIdMessage('история 5')).toBeNull()
  })

  it('returns null for zero', () => {
    expect(parseStoryIdMessage('0')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(parseStoryIdMessage('   ')).toBeNull()
  })
})

describe('statusEmoji', () => {
  it('maps known statuses to distinct icons', () => {
    expect(statusEmoji('ready')).toBe('✅')
    expect(statusEmoji('proofreading')).toBe('📝')
    expect(statusEmoji('read')).toBe('📖')
    expect(statusEmoji('archived')).toBe('🗂️')
  })

  it('falls back to a pending icon for unknown or missing status', () => {
    expect(statusEmoji('draft')).toBe('⏳')
    expect(statusEmoji(null)).toBe('⏳')
  })
})

describe('storyLabel', () => {
  it('uses the title when present', () => {
    expect(storyLabel({ id: 7, title: 'Гоша и лес', status: 'ready' })).toBe('№7 — Гоша и лес')
  })

  it('falls back to a numbered placeholder when the title is empty', () => {
    expect(storyLabel({ id: 7, title: '', status: 'ready' })).toBe('№7 — История №7')
  })
})

describe('formatStoriesList', () => {
  it('renders a numbered list with status icons and a how-to-read hint', () => {
    const text = formatStoriesList(
      [
        { id: 12, title: 'Карта', status: 'ready' },
        { id: 9, title: 'Лес', status: 'proofreading' },
      ],
      'Новые и на вычитке:',
    )

    expect(text).toContain('Новые и на вычитке:')
    expect(text).toContain('✅ №12 — Карта')
    expect(text).toContain('📝 №9 — Лес')
    expect(text).toContain('Отправь номер истории')
  })

  it('shows an empty-state message when there are no stories', () => {
    expect(formatStoriesList([], 'Прочитанные:')).toBe('Прочитанные:\n\nПока пусто.')
  })
})

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkText('hello', 4096)).toEqual(['hello'])
  })

  it('splits long text into chunks no larger than the limit', () => {
    const chunks = chunkText('a'.repeat(10), 4)

    expect(chunks).toEqual(['aaaa', 'aaaa', 'aa'])
  })

  it('returns no chunks for empty text', () => {
    expect(chunkText('', 4096)).toEqual([])
  })
})

describe('pickReadableText', () => {
  it('prefers the final approved text', () => {
    expect(pickReadableText({ textFinal: 'final', textV2: 'v2', textV1: 'v1' })).toBe('final')
  })

  it('falls back to the latest draft when not yet approved', () => {
    expect(pickReadableText({ textFinal: null, textV2: 'v2', textV1: 'v1' })).toBe('v2')
    expect(pickReadableText({ textFinal: null, textV2: null, textV1: 'v1' })).toBe('v1')
  })

  it('returns null when no text exists yet', () => {
    expect(pickReadableText({ textFinal: null, textV2: null, textV1: null })).toBeNull()
  })
})
