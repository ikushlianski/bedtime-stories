import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateStoryTitle, titleContainsForbiddenWord } from './title-generator'

vi.mock('../../ai', () => ({
  aiRunner: { runText: vi.fn() },
}))

import { aiRunner } from '../../ai'

describe('titleContainsForbiddenWord', () => {
  it('flags exact and inflected forms of the forbidden words', () => {
    expect(titleContainsForbiddenWord('Тайна ночного леса')).toBe(true)
    expect(titleContainsForbiddenWord('Тайну хранит река')).toBe(true)
    expect(titleContainsForbiddenWord('Волшебный сад Гоши')).toBe(true)
    expect(titleContainsForbiddenWord('Волшебная поляна')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(titleContainsForbiddenWord('ТАЙНА леса')).toBe(true)
  })

  it('does not flag unrelated titles', () => {
    expect(titleContainsForbiddenWord('Приключение у реки')).toBe(false)
  })
})

describe('generateStoryTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('always includes the forbidden-word instruction in the prompt', async () => {
    vi.mocked(aiRunner.runText).mockResolvedValueOnce('Приключение у реки')

    await generateStoryTitle({ plan: 'plan text', seed: 'seed text' })

    const call = vi.mocked(aiRunner.runText).mock.calls[0]?.[0]
    expect(call?.prompt).toContain('Тайна')
    expect(call?.prompt).toContain('Волшебный')
    expect(call?.prompt).toContain('STRICTLY FORBIDDEN')
  })

  it('lists recent titles and instructs the model not to repeat their pattern', async () => {
    vi.mocked(aiRunner.runText).mockResolvedValueOnce('Приключение у реки')

    await generateStoryTitle({
      plan: 'plan text',
      seed: 'seed text',
      recentTitles: ['Тайна ночного леса', 'Волшебная поляна'],
    })

    const call = vi.mocked(aiRunner.runText).mock.calls[0]?.[0]
    expect(call?.prompt).toContain('Тайна ночного леса')
    expect(call?.prompt).toContain('Волшебная поляна')
    expect(call?.prompt).toContain('НЕ повторяй')
  })

  it('omits the recent-titles block when none are given', async () => {
    vi.mocked(aiRunner.runText).mockResolvedValueOnce('Приключение у реки')

    await generateStoryTitle({ plan: 'plan text', seed: 'seed text' })

    const call = vi.mocked(aiRunner.runText).mock.calls[0]?.[0]
    expect(call?.prompt).not.toContain('Недавние заголовки')
  })

  it('returns the title as-is when it contains no forbidden word', async () => {
    vi.mocked(aiRunner.runText).mockResolvedValueOnce('Приключение у реки')

    const title = await generateStoryTitle({ plan: 'plan text', seed: 'seed text' })

    expect(title).toBe('Приключение у реки')
    expect(aiRunner.runText).toHaveBeenCalledTimes(1)
  })

  it('retries once with a strengthened prompt when the title contains a forbidden word', async () => {
    vi.mocked(aiRunner.runText)
      .mockResolvedValueOnce('Тайна ночного леса')
      .mockResolvedValueOnce('Приключение у реки')

    const title = await generateStoryTitle({ plan: 'plan text', seed: 'seed text' })

    expect(title).toBe('Приключение у реки')
    expect(aiRunner.runText).toHaveBeenCalledTimes(2)

    const retryCall = vi.mocked(aiRunner.runText).mock.calls[1]?.[0]
    expect(retryCall?.prompt).toContain('Тайна ночного леса')
    expect(retryCall?.prompt).toContain('previous answer')
  })

  it('returns the retry result even if it still contains a forbidden word, without a second retry', async () => {
    vi.mocked(aiRunner.runText)
      .mockResolvedValueOnce('Тайна ночного леса')
      .mockResolvedValueOnce('Волшебная поляна')

    const title = await generateStoryTitle({ plan: 'plan text', seed: 'seed text' })

    expect(title).toBe('Волшебная поляна')
    expect(aiRunner.runText).toHaveBeenCalledTimes(2)
  })

  it('strips surrounding quotes from the final title', async () => {
    vi.mocked(aiRunner.runText).mockResolvedValueOnce('"Приключение у реки"')

    const title = await generateStoryTitle({ plan: 'plan text', seed: 'seed text' })

    expect(title).toBe('Приключение у реки')
  })
})
