import { describe, it, expect } from 'vitest'
import { createStorySchema, resolveCreateStoryMode } from './create-story-schema'

describe('createStorySchema', () => {
  describe('seed-only input', () => {
    it('accepts a valid seed', () => {
      const result = createStorySchema.safeParse({ seed: 'A hero learns patience' })

      expect(result.success).toBe(true)
    })

    it('rejects an empty seed', () => {
      const result = createStorySchema.safeParse({ seed: '' })

      expect(result.success).toBe(false)
    })
  })

  describe('textFinal input', () => {
    it('accepts textFinal with a title', () => {
      const result = createStorySchema.safeParse({
        title: 'My Story',
        textFinal: 'Once upon a time...',
      })

      expect(result.success).toBe(true)
    })

    it('accepts textFinal without a title', () => {
      const result = createStorySchema.safeParse({ textFinal: 'Once upon a time...' })

      expect(result.success).toBe(true)
    })
  })

  describe('exclusivity', () => {
    it('rejects input with both seed and textFinal', () => {
      const result = createStorySchema.safeParse({
        seed: 'hero learns',
        textFinal: 'Once upon a time...',
      })

      expect(result.success).toBe(false)
    })

    it('rejects input with neither seed nor textFinal', () => {
      const result = createStorySchema.safeParse({})

      expect(result.success).toBe(false)
    })

    it('rejects input with only a title', () => {
      const result = createStorySchema.safeParse({ title: 'My Story' })

      expect(result.success).toBe(false)
    })
  })
})

describe('resolveCreateStoryMode', () => {
  it('returns agent mode with trimmed title from seed', () => {
    const result = resolveCreateStoryMode({ seed: '  Hero learns patience  ' })

    expect(result).toEqual({
      mode: 'agent',
      seed: '  Hero learns patience  ',
      title: 'Hero learns patience',
    })
  })

  it('truncates long seeds to 60 chars for the title', () => {
    const longSeed = 'A'.repeat(120)
    const result = resolveCreateStoryMode({ seed: longSeed })

    if (result.mode !== 'agent') {
      throw new Error('expected agent mode')
    }

    expect(result.title.length).toBe(60)
  })

  it('returns user mode with provided title', () => {
    const result = resolveCreateStoryMode({
      title: 'Bedtime tale',
      textFinal: 'Once upon a time...',
    })

    expect(result).toEqual({
      mode: 'user',
      title: 'Bedtime tale',
      textFinal: 'Once upon a time...',
    })
  })

  it('falls back to textFinal for the title when title is missing', () => {
    const result = resolveCreateStoryMode({ textFinal: 'Once upon a time, a brave bear' })

    if (result.mode !== 'user') {
      throw new Error('expected user mode')
    }

    expect(result.title).toBe('Once upon a time, a brave bear')
  })

  it('truncates long textFinal titles to 60 chars', () => {
    const longText = 'Z'.repeat(200)
    const result = resolveCreateStoryMode({ textFinal: longText })

    if (result.mode !== 'user') {
      throw new Error('expected user mode')
    }

    expect(result.title.length).toBe(60)
  })

  describe('perStageOverrides', () => {
    it('accepts a partial map of stage overrides', () => {
      const result = createStorySchema.safeParse({
        seed: 'hero',
        perStageOverrides: {
          writer: { model: 'free/writer', fallback: 'paid/writer' },
          plotter: { model: 'free/plotter' },
        },
      })

      expect(result.success).toBe(true)
    })

    it('forwards perStageOverrides into agent mode', () => {
      const resolved = resolveCreateStoryMode({
        seed: 'hero learns patience',
        perStageOverrides: { writer: { model: 'free/writer' } },
      })

      if (resolved.mode !== 'agent') {
        throw new Error('expected agent mode')
      }

      expect(resolved.perStageOverrides).toEqual({ writer: { model: 'free/writer' } })
    })

    it('omits perStageOverrides from agent mode when the map is empty', () => {
      const resolved = resolveCreateStoryMode({ seed: 'hero', perStageOverrides: {} })

      if (resolved.mode !== 'agent') {
        throw new Error('expected agent mode')
      }

      expect(resolved.perStageOverrides).toBeUndefined()
    })
  })
})
