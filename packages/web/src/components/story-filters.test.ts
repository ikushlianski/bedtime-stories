import { describe, expect, it } from 'vitest'
import { activeFilterCount, DEFAULT_FILTERS, hasCustomFilters, type StoryFilterState } from './story-filters'

function filtersWith(overrides: Partial<StoryFilterState>): StoryFilterState {
  return { ...DEFAULT_FILTERS, ...overrides }
}

describe('activeFilterCount', () => {
  it('counts the default ready status as an active API filter', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(1)
  })

  it('counts status, universe, and category filters', () => {
    const filters = filtersWith({ status: 'read', groupId: 7, tag: 'calm' })

    expect(activeFilterCount(filters)).toBe(3)
  })

  it('does not count all status as active', () => {
    expect(activeFilterCount(filtersWith({ status: 'all' }))).toBe(0)
  })
})

describe('hasCustomFilters', () => {
  it('treats default filters as not custom', () => {
    expect(hasCustomFilters(DEFAULT_FILTERS)).toBe(false)
  })

  it('detects changes from default filters', () => {
    expect(hasCustomFilters(filtersWith({ tag: 'bedtime' }))).toBe(true)
  })
})
