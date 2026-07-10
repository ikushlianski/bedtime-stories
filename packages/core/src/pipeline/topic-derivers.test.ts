import { describe, it, expect } from 'vitest'
import { synthesizeSeedFromTopics, filterValidCombos, isValidComboSelection, type TopicCombo } from './topic-derivers'

describe('synthesizeSeedFromTopics', () => {
  it('includes every topic title in the seed', () => {
    const seed = synthesizeSeedFromTopics([{ title: 'Дружба' }, { title: 'Честность', note: 'признаться, когда ошибся' }])

    expect(seed).toContain('Дружба')
    expect(seed).toContain('Честность')
    expect(seed).toContain('признаться, когда ошибся')
  })

  it('omits an empty note gracefully', () => {
    const seed = synthesizeSeedFromTopics([{ title: 'Смелость', note: '   ' }])

    expect(seed).toContain('«Смелость»')
    expect(seed).not.toContain('«Смелость» —')
  })
})

describe('filterValidCombos', () => {
  const eligible = [1, 2, 3, 4]
  const make = (topicIds: number[]): TopicCombo => ({ topicIds, title: 't', seed: 's', rationale: 'r' })

  it('keeps combos of 2-3 topics that all exist', () => {
    const combos = [make([1, 2]), make([2, 3, 4])]

    expect(filterValidCombos(combos, eligible)).toHaveLength(2)
  })

  it('drops combos referencing unknown topic ids', () => {
    const combos = [make([1, 99])]

    expect(filterValidCombos(combos, eligible)).toHaveLength(0)
  })

  it('drops combos outside the 2-3 size window', () => {
    const combos = [make([1]), make([1, 2, 3, 4])]

    expect(filterValidCombos(combos, eligible)).toHaveLength(0)
  })
})

describe('isValidComboSelection', () => {
  it('accepts a valid 2-3 selection of known topics', () => {
    expect(isValidComboSelection([1, 2], [1, 2, 3])).toBe(true)
  })

  it('rejects a selection with an unknown topic', () => {
    expect(isValidComboSelection([1, 5], [1, 2, 3])).toBe(false)
  })

  it('rejects a single-topic or oversized selection', () => {
    expect(isValidComboSelection([1], [1, 2, 3])).toBe(false)
    expect(isValidComboSelection([1, 2, 3, 4], [1, 2, 3, 4])).toBe(false)
  })

  it('treats duplicate ids as their unique set', () => {
    expect(isValidComboSelection([1, 1, 2], [1, 2, 3])).toBe(true)
  })
})
