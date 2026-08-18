import { describe, it, expect } from 'vitest'
import { extractReferenceStoryIdFromSeed } from './extract-reference-story-id'

describe('extractReferenceStoryIdFromSeed', () => {
  it('finds an ID from a URL on its own line within a larger seed', () => {
    const seed = [
      'https://bedtime-agent.ilya.online/stories/127',
      '',
      'Write a new story about the same characters,',
      'building on the song from that one.',
    ].join('\n')

    expect(extractReferenceStoryIdFromSeed(seed)).toBe(127)
  })

  it('finds a bare /stories/N fragment', () => {
    expect(extractReferenceStoryIdFromSeed('see /stories/42 for context')).toBe(42)
  })

  it('matches a URL with a trailing slash', () => {
    expect(extractReferenceStoryIdFromSeed('https://bedtime-agent.ilya.online/stories/127/')).toBe(127)
  })

  it('matches a URL with a trailing query string', () => {
    expect(extractReferenceStoryIdFromSeed('https://bedtime-agent.ilya.online/stories/127?tab=text')).toBe(127)
  })

  it('matches a URL with a trailing path segment', () => {
    expect(extractReferenceStoryIdFromSeed('https://bedtime-agent.ilya.online/stories/127/edit')).toBe(127)
  })

  it('returns the first match when the seed contains two story links', () => {
    expect(extractReferenceStoryIdFromSeed('/stories/127 and also /stories/200')).toBe(127)
  })

  it('returns null when no story path is present', () => {
    expect(extractReferenceStoryIdFromSeed('A hero learns patience over 127 рублей')).toBeNull()
  })

  it('does not false-positive on unrelated numbers in prose', () => {
    expect(extractReferenceStoryIdFromSeed('Гоше было 127 рублей, а сестре в 5 лет было страшно')).toBeNull()
  })

  it('returns null for an empty seed', () => {
    expect(extractReferenceStoryIdFromSeed('')).toBeNull()
  })
})
