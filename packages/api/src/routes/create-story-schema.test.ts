import { describe, it, expect } from 'vitest'
import { createStorySchema, resolveCreateStoryMode } from './create-story-schema'

describe('createStorySchema', () => {
  describe('seed-only input', () => {
    it('accepts a valid seed with models for all stages', () => {
      const result = createStorySchema.safeParse({
        seed: 'A hero learns patience',
        perStageOverrides: {
          plotter: { model: 'gpt-4' },
          writer: { model: 'claude-3' },
          plotterQuestions: { model: 'gpt-4-turbo' },
        },
      })

      expect(result.success).toBe(true)
    })

    it('accepts a seed without models (backend uses DeepSeek defaults)', () => {
      const result = createStorySchema.safeParse({ seed: 'A hero learns patience' })

      expect(result.success).toBe(true)
    })

    it('rejects an empty seed', () => {
      const result = createStorySchema.safeParse({ seed: '' })

      expect(result.success).toBe(false)
    })
  })

  describe('structureKey and lensKey', () => {
    it('accepts a known structureKey and lensKey', () => {
      const result = createStorySchema.safeParse({
        seed: 'A hero learns patience',
        structureKey: 'snowball',
        lensKey: 'gosha-errs',
      })

      expect(result.success).toBe(true)
    })

    it('accepts a seed without structureKey or lensKey (auto rotation)', () => {
      const result = createStorySchema.safeParse({ seed: 'A hero learns patience' })

      expect(result.success).toBe(true)
    })

    it('rejects an unknown structureKey with a clear error', () => {
      const result = createStorySchema.safeParse({
        seed: 'A hero learns patience',
        structureKey: 'not-a-real-structure',
      })

      expect(result.success).toBe(false)

      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Unknown structureKey')
      }
    })

    it('rejects an unknown lensKey with a clear error', () => {
      const result = createStorySchema.safeParse({
        seed: 'A hero learns patience',
        lensKey: 'not-a-real-lens',
      })

      expect(result.success).toBe(false)

      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Unknown lensKey')
      }
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
    it('accepts models for all required stages', () => {
      const result = createStorySchema.safeParse({
        seed: 'hero',
        perStageOverrides: {
          writer: { model: 'free/writer', fallback: 'paid/writer' },
          plotter: { model: 'free/plotter' },
          plotterQuestions: { model: 'gpt-4-turbo' },
        },
      })

      expect(result.success).toBe(true)
    })

    it('rejects when a required stage is missing', () => {
      const result = createStorySchema.safeParse({
        seed: 'hero',
        perStageOverrides: {
          writer: { model: 'free/writer' },
          plotter: { model: 'free/plotter' },
        },
      })

      expect(result.success).toBe(false)
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

  describe('manualTopicIds', () => {
    it('accepts a list of positive topic ids', () => {
      const result = createStorySchema.safeParse({
        seed: 'hero learns patience',
        manualTopicIds: [1, 2, 3],
      })

      expect(result.success).toBe(true)
    })

    it('rejects non-positive topic ids', () => {
      const result = createStorySchema.safeParse({
        seed: 'hero learns patience',
        manualTopicIds: [1, -2],
      })

      expect(result.success).toBe(false)
    })

    it('forwards deduplicated manualTopicIds into agent mode', () => {
      const resolved = resolveCreateStoryMode({
        seed: 'hero learns patience',
        manualTopicIds: [3, 1, 3, 2],
      })

      if (resolved.mode !== 'agent') {
        throw new Error('expected agent mode')
      }

      expect(resolved.manualTopicIds).toEqual([3, 1, 2])
    })

    it('omits manualTopicIds from agent mode when not provided', () => {
      const resolved = resolveCreateStoryMode({ seed: 'hero learns patience' })

      if (resolved.mode !== 'agent') {
        throw new Error('expected agent mode')
      }

      expect(resolved.manualTopicIds).toBeUndefined()
    })

    it('omits manualTopicIds from agent mode when the list is empty', () => {
      const resolved = resolveCreateStoryMode({ seed: 'hero learns patience', manualTopicIds: [] })

      if (resolved.mode !== 'agent') {
        throw new Error('expected agent mode')
      }

      expect(resolved.manualTopicIds).toBeUndefined()
    })
  })

  describe('structureKey and lensKey', () => {
    it('forwards an explicit structureKey and lensKey into agent mode', () => {
      const resolved = resolveCreateStoryMode({
        seed: 'hero learns patience',
        structureKey: 'snowball',
        lensKey: 'gosha-errs',
      })

      if (resolved.mode !== 'agent') {
        throw new Error('expected agent mode')
      }

      expect(resolved.structureKey).toBe('snowball')
      expect(resolved.lensKey).toBe('gosha-errs')
    })

    it('omits structureKey and lensKey from agent mode when not provided', () => {
      const resolved = resolveCreateStoryMode({ seed: 'hero learns patience' })

      if (resolved.mode !== 'agent') {
        throw new Error('expected agent mode')
      }

      expect(resolved.structureKey).toBeUndefined()
      expect(resolved.lensKey).toBeUndefined()
    })
  })
})
