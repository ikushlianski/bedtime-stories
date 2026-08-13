import { describe, it, expect, vi } from 'vitest'

vi.mock('../db/client', () => ({ db: {} }))
vi.mock('./stages/topic-candidate-suggester', () => ({ suggestTopicCandidates: vi.fn() }))

const { isPlausibleTopicTitle } = await import('./generate-topic-candidates')

describe('isPlausibleTopicTitle', () => {
  it('accepts a normal short title', () => {
    expect(isPlausibleTopicTitle('Как справляться с проигрышем')).toBe(true)
  })

  it('accepts a long but coherent human-written title', () => {
    expect(
      isPlausibleTopicTitle(
        'Важно, чтобы ходить на спортивную секцию, хотя бы какую-то либо футбол, либо борьба, плавание, теннис, даже шахматы и так далее, что угодно, но должен быть спорт, особенно физический спорт',
      ),
    ).toBe(true)
  })

  it('rejects an empty title', () => {
    expect(isPlausibleTopicTitle('')).toBe(false)
  })

  it('rejects a title longer than the max length', () => {
    expect(isPlausibleTopicTitle('a'.repeat(201))).toBe(false)
  })

  it('rejects a title with a degenerate repeated-character run', () => {
    expect(isPlausibleTopicTitle('Дружба несмотря на различия характеровююююююю')).toBe(false)
  })
})
