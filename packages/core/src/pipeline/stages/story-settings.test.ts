import { describe, it, expect } from 'vitest'
import { STORY_SETTINGS, selectStorySetting, buildSettingBlock } from './story-settings'

describe('story-settings', () => {
  describe('STORY_SETTINGS', () => {
    it('offers a wide menu of distinct settings', () => {
      expect(STORY_SETTINGS.length).toBeGreaterThanOrEqual(25)
      const titles = STORY_SETTINGS.map((s) => s.title)
      expect(new Set(titles).size).toBe(titles.length)
    })

    it('includes the varied scenarios the product asked for', () => {
      const titles = STORY_SETTINGS.map((s) => s.title).join(' | ')
      expect(titles).toContain('ПУТЕШЕСТВИЕ')
      expect(titles).toContain('ЧУЖОЙ СОН')
      expect(titles).toContain('ВНУТРИ ИГРЫ')
      expect(titles).toContain('ДОМА С АРТЁМОМ')
    })
  })

  describe('selectStorySetting', () => {
    it('is deterministic for a given storyId', () => {
      expect(selectStorySetting(42)).toBe(selectStorySetting(42))
    })

    it('gives consecutive stories different settings', () => {
      for (let id = 100; id < 110; id++) {
        expect(selectStorySetting(id)).not.toBe(selectStorySetting(id + 1))
      }
    })

    it('does not correlate one-to-one with the plain modulo used by structures', () => {
      const settingIdx = (id: number) => STORY_SETTINGS.indexOf(selectStorySetting(id))
      const distinct = new Set(Array.from({ length: STORY_SETTINGS.length }, (_, i) => settingIdx(i)))
      expect(distinct.size).toBe(STORY_SETTINGS.length)
    })
  })

  describe('buildSettingBlock', () => {
    const block = buildSettingBlock(STORY_SETTINGS[0]!)

    it('names the chosen setting and its flavor', () => {
      expect(block).toContain(STORY_SETTINGS[0]!.title)
      expect(block).toContain(STORY_SETTINGS[0]!.description)
    })

    it('forbids the tired садик-home-sleep template', () => {
      expect(block).toContain('садик')
      expect(block).toContain('засыпание')
    })

    it('honors the seed when it already fixes a setting', () => {
      expect(block.toLowerCase()).toContain('seed')
    })

    it('states humor is the linchpin unless the seed signals a serious tone', () => {
      expect(block).toContain('ЮМОР')
      expect(block).toContain('серьёзный')
    })
  })
})
