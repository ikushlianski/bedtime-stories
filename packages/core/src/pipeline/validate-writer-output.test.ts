import { describe, it, expect } from 'vitest'
import { validateWriterOutput } from './validate-writer-output'

function words(count: number, base = 'слово'): string {
  return Array.from({ length: count }, (_, i) => `${base}${i}`).join(' ')
}

describe('validateWriterOutput', () => {
  it('accepts a normal story-length text with no option/choice signature', () => {
    const text = `Гоша шёл по двору и думал о рации. ${words(820)}`

    expect(validateWriterOutput(text)).toEqual({ valid: true })
  })

  it('rejects output far shorter than the 800-1200 word target', () => {
    const text = words(150)
    const result = validateWriterOutput(text)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toContain('150')
    }
  })

  it('accepts output right at the minimum floor', () => {
    expect(validateWriterOutput(words(400))).toEqual({ valid: true })
  })

  it('rejects output one word below the minimum floor', () => {
    const result = validateWriterOutput(words(399))

    expect(result.valid).toBe(false)
  })

  it('treats an empty string as zero words and rejects it', () => {
    const result = validateWriterOutput('   ')

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toContain('0')
    }
  })

  it('rejects the real meta-discussion response that corrupted story 139', () => {
    const text = 'Вот несколько вариантов, куда можно перенести действие — все проще и прозрачнее нынешней схемы с рациями в разных комнатах:\n\n' +
      `Вариант А. Двор у дома. ${words(80)}\n\n` +
      `Вариант Б. Дачный участок. ${words(80)}\n\n` +
      `Вариант В. Соседний парк. ${words(300)}`

    const result = validateWriterOutput(text)

    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toMatch(/option/i)
    }
  })

  it('rejects output with two or more "Вариант X" section headers even above the word floor', () => {
    const text = `Вариант А. Первый вариант с длинным описанием. ${words(300)}\n\nВариант Б. Второй вариант с описанием. ${words(300)}`

    expect(validateWriterOutput(text).valid).toBe(false)
  })

  it('does not reject a single incidental mention of "вариант" in real prose', () => {
    const text = `Гоша выбрал другой вариант действий и побежал во двор. ${words(820)}`

    expect(validateWriterOutput(text)).toEqual({ valid: true })
  })

  it('rejects output opening with "Вот несколько идей" even without option headers', () => {
    const text = `Вот несколько идей, как можно было бы переписать историю. ${words(500)}`

    expect(validateWriterOutput(text).valid).toBe(false)
  })

  it('rejects output that asks the reader to pick between alternatives', () => {
    const text = `${words(500)} Какой из вариантов тебе больше нравится?`

    expect(validateWriterOutput(text).valid).toBe(false)
  })
})
