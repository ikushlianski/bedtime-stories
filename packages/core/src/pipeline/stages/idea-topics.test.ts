import { describe, it, expect } from 'vitest'
import { KID_TOPICS, selectDiverseTopics, buildDiverseTopicsBlock } from './idea-topics'

describe('KID_TOPICS', () => {
  it('offers a broad palette (100+) of distinct kid topics', () => {
    expect(KID_TOPICS.length).toBeGreaterThanOrEqual(100)
    expect(new Set(KID_TOPICS).size).toBe(KID_TOPICS.length)
  })
})

describe('selectDiverseTopics', () => {
  it('returns the requested number of distinct topics', () => {
    const picked = selectDiverseTopics(12)

    expect(picked).toHaveLength(12)
    expect(new Set(picked).size).toBe(12)
  })

  it('varies the selection across calls', () => {
    let seed = 1
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const a = selectDiverseTopics(10, rng).join('|')
    const b = selectDiverseTopics(10, rng).join('|')

    expect(a).not.toBe(b)
  })

  it('never returns more topics than exist', () => {
    expect(selectDiverseTopics(9999).length).toBe(KID_TOPICS.length)
  })
})

describe('buildDiverseTopicsBlock', () => {
  it('lists the topics and warns against defaulting to adventure and magic', () => {
    const block = buildDiverseTopicsBlock(['страх темноты', 'почему небо голубое'])

    expect(block).toContain('страх темноты')
    expect(block).toContain('приключени')
    expect(block).toContain('магия')
  })
})
