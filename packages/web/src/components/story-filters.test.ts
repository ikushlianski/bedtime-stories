import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { activeFilterCount, DEFAULT_FILTERS, hasCustomFilters, loadStoredFilters, saveStoredFilters, type StoryFilterState } from './story-filters'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() { return store.size },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => { store.delete(key) },
    setItem: (key, value) => { store.set(key, value) },
  }
}

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', { value: createMemoryStorage(), configurable: true })
  }
})

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

describe('stored filter persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing is stored', () => {
    expect(loadStoredFilters()).toEqual(DEFAULT_FILTERS)
  })

  it('round-trips a saved filter state', () => {
    const saved = filtersWith({ status: 'read', groupId: 7, tag: 'calm' })

    saveStoredFilters(saved)

    expect(loadStoredFilters()).toEqual(saved)
  })

  it('falls back to defaults when stored payload is malformed', () => {
    localStorage.setItem('story-list-filters-v1', '{"status":"bogus"}')

    expect(loadStoredFilters()).toEqual(DEFAULT_FILTERS)
  })
})
