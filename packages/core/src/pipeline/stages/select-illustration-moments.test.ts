import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../ai', () => ({
  aiRunner: { runStructured: vi.fn() },
}))

vi.mock('../derivers/resolve-stage-model', () => ({
  resolveStageModel: vi.fn(async () => ({ model: 'deepseek/deepseek-v4-flash', fallback: 'deepseek/deepseek-v4-pro' })),
}))

import { selectIllustrationMoments } from './select-illustration-moments'
import { aiRunner } from '../../ai'
import { resolveStageModel } from '../derivers/resolve-stage-model'

describe('selectIllustrationMoments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(resolveStageModel).mockResolvedValue({ model: 'deepseek/deepseek-v4-flash', fallback: 'deepseek/deepseek-v4-pro' })
  })

  it('asks for the requested count in the prompt and uses the illustrationMomentSelector stage', async () => {
    vi.mocked(aiRunner.runStructured).mockResolvedValueOnce({ moments: [] })

    await selectIllustrationMoments({ storyText: 'story text', castNames: ['Гоша'], count: 2 })

    const call = vi.mocked(aiRunner.runStructured).mock.calls[0]?.[0]
    expect(call?.stage).toBe('illustrationMomentSelector')
    expect(call?.skill).toBe('story-illustration-moments')
    expect(call?.prompt).toContain('count): 2')
    expect(call?.prompt).toContain('Гоша')
    expect(call?.prompt).toContain('story text')
  })

  it('includes already-marked passages as avoid-duplication context', async () => {
    vi.mocked(aiRunner.runStructured).mockResolvedValueOnce({ moments: [] })

    await selectIllustrationMoments({
      storyText: 'story text',
      castNames: [],
      count: 1,
      alreadyMarkedTexts: ['Уже отмеченный отрывок'],
    })

    const call = vi.mocked(aiRunner.runStructured).mock.calls[0]?.[0]
    expect(call?.prompt).toContain('count): 1')
    expect(call?.prompt).toContain('Уже отмеченный отрывок')
    expect(call?.prompt).toMatch(/не дублируй/i)
  })

  it('slices an over-returning model response down to the requested count', async () => {
    vi.mocked(aiRunner.runStructured).mockResolvedValueOnce({
      moments: [
        { scene_description: 'сцена 1', character_names: [] },
        { scene_description: 'сцена 2', character_names: [] },
      ],
    })

    const result = await selectIllustrationMoments({ storyText: 'story text', castNames: [], count: 1 })

    expect(result.moments).toHaveLength(1)
    expect(result.moments[0]?.scene_description).toBe('сцена 1')
  })

  it('resolves the model via resolveStageModel using the story universe id', async () => {
    vi.mocked(aiRunner.runStructured).mockResolvedValueOnce({ moments: [] })

    await selectIllustrationMoments({ storyText: 'story text', castNames: [], count: 2, universeId: 42 })

    expect(resolveStageModel).toHaveBeenCalledWith(42, 'illustrationMomentSelector')
  })
})
