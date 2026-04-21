import { describe, it, expect } from 'vitest'
import { appendFactToDescription } from './universe-facts'

describe('appendFactToDescription', () => {
  it('starts a new bullet list when description is empty', () => {
    expect(appendFactToDescription('', 'любит море')).toBe('- любит море')
  })

  it('appends a new bullet to existing description', () => {
    const result = appendFactToDescription('- храбрый', 'любит море')

    expect(result).toBe('- храбрый\n- любит море')
  })

  it('treats whitespace-only description as empty', () => {
    expect(appendFactToDescription('   ', 'любит море')).toBe('- любит море')
  })
})
