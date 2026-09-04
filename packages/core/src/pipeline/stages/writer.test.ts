import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runWriter } from './writer'
import { STORY_STRUCTURES, selectStoryStructure } from './story-structures'
import { CHARACTER_LENSES, selectCharacterLens } from './character-lenses'
import { VOICE_REGISTERS, selectVoiceRegister } from './voice-registers'

vi.mock('../prompt-resolver', () => ({
  resolvePrompt: vi.fn().mockResolvedValue({ text: 'base writer prompt', version: 1 }),
}))

vi.mock('../../ai', () => ({
  aiRunner: { runText: vi.fn().mockResolvedValue('story text') },
}))

import { aiRunner } from '../../ai'

describe('runWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes the explicitly chosen structure and character lens in the prompt', async () => {
    const structure = STORY_STRUCTURES[2]!
    const characterLens = CHARACTER_LENSES[4]!

    await runWriter({ plan: 'plan text', model: 'test-model', structure, characterLens })

    const call = vi.mocked(aiRunner.runText).mock.calls[0]?.[0]
    expect(call?.prompt).toContain(structure.title)
    expect(call?.prompt).toContain(structure.ending)
    expect(call?.prompt).toContain(characterLens.title)
    expect(call?.prompt).toContain(characterLens.guidance)
  })

  it('falls back to rotation-by-storyId when no explicit structure/lens is given', async () => {
    await runWriter({ plan: 'plan text', model: 'test-model', storyId: 3 })

    const call = vi.mocked(aiRunner.runText).mock.calls[0]?.[0]
    expect(call?.prompt).toContain(selectStoryStructure(3).title)
    expect(call?.prompt).toContain(selectCharacterLens(3).title)
  })

  it('includes the explicitly chosen voice register in the prompt', async () => {
    const voice = VOICE_REGISTERS[3]!

    await runWriter({ plan: 'plan text', model: 'test-model', voice })

    const call = vi.mocked(aiRunner.runText).mock.calls[0]?.[0]
    expect(call?.prompt).toContain(voice.title)
    expect(call?.prompt).toContain(voice.description)
  })

  it('falls back to rotation-by-storyId for voice when none is given', async () => {
    await runWriter({ plan: 'plan text', model: 'test-model', storyId: 5 })

    const call = vi.mocked(aiRunner.runText).mock.calls[0]?.[0]
    expect(call?.prompt).toContain(selectVoiceRegister(5).title)
  })

  it('bans the overused vague-feeling cliché and asks for concrete emotional language', async () => {
    await runWriter({ plan: 'plan text', model: 'test-model' })

    const call = vi.mocked(aiRunner.runText).mock.calls[0]?.[0]
    expect(call?.prompt).toContain('внутри что-то бумкнуло')
    expect(call?.prompt).toContain('ЗАПРЕЩЕНО')
  })
})
