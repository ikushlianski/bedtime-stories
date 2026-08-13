import { describe, it, expect } from 'vitest'
import { sendMessageSchema } from './send-message-schema'

describe('sendMessageSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = sendMessageSchema.safeParse({ message: 'What should happen next?' })

    expect(result.success).toBe(true)
  })

  it('rejects an empty message', () => {
    const result = sendMessageSchema.safeParse({ message: '' })

    expect(result.success).toBe(false)
  })

  it('accepts a message at exactly 2000 characters', () => {
    const result = sendMessageSchema.safeParse({ message: 'a'.repeat(2000) })

    expect(result.success).toBe(true)
  })

  it('rejects a message over 2000 characters', () => {
    const result = sendMessageSchema.safeParse({ message: 'a'.repeat(2001) })

    expect(result.success).toBe(false)
  })

  it('carries the custom Russian message when message is too long', () => {
    const result = sendMessageSchema.safeParse({ message: 'a'.repeat(2001) })

    if (result.success) {
      throw new Error('expected validation to fail')
    }

    expect(result.error.issues[0]?.message).toBe('Слишком длинное сообщение (максимум 2000 символов)')
  })

  it('still accepts optional selectedText and context alongside a valid message', () => {
    const result = sendMessageSchema.safeParse({
      message: 'Rewrite this passage',
      selectedText: 'a fragment of the text',
      context: 'text',
    })

    expect(result.success).toBe(true)
  })
})
