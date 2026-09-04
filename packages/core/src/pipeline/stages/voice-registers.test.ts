import { describe, it, expect } from 'vitest'
import { VOICE_REGISTERS, selectVoiceRegister, buildVoiceBlock } from './voice-registers'

describe('selectVoiceRegister', () => {
  it('picks a stable voice for a given storyId', () => {
    expect(selectVoiceRegister(3)).toBe(selectVoiceRegister(3))
  })

  it('rotates through voices for consecutive storyIds', () => {
    const picked = new Set(
      Array.from({ length: VOICE_REGISTERS.length }, (_, i) => selectVoiceRegister(i).title),
    )

    expect(picked.size).toBe(VOICE_REGISTERS.length)
  })

  it('falls back to a valid voice when storyId is missing', () => {
    expect(VOICE_REGISTERS).toContain(selectVoiceRegister(undefined))
  })
})

describe('buildVoiceBlock', () => {
  it('names the chosen register and its description', () => {
    const voice = VOICE_REGISTERS[2]!
    const block = buildVoiceBlock(voice)

    expect(block).toContain(voice.title)
    expect(block).toContain(voice.description)
  })
})
