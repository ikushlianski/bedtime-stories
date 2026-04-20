import { useState, useRef, useEffect } from 'react'
import { z } from 'zod'
import type { StoryGroup } from '../lib/api'
import StoryFilterTabs from './story-filter-tabs'

export type StatusFilter = 'all' | 'draft' | 'ready' | 'read' | 'archived'

export interface StoryFilterState {
  status: StatusFilter
  groupId: number | null
  tag: string | null
}

export const DEFAULT_FILTERS: StoryFilterState = {
  status: 'ready',
  groupId: null,
  tag: null,
}

const STORED_FILTERS_KEY = 'story-list-filters-v1'

const storedFiltersSchema = z.object({
  status: z.enum(['all', 'draft', 'ready', 'read', 'archived']),
  groupId: z.number().int().nullable(),
  tag: z.string().nullable(),
})

export function loadStoredFilters(): StoryFilterState {
  try {
    const raw = localStorage.getItem(STORED_FILTERS_KEY)

    if (!raw) return DEFAULT_FILTERS

    const parsed = storedFiltersSchema.safeParse(JSON.parse(raw))

    return parsed.success ? parsed.data : DEFAULT_FILTERS
  } catch {
    return DEFAULT_FILTERS
  }
}

export function saveStoredFilters(value: StoryFilterState) {
  try {
    localStorage.setItem(STORED_FILTERS_KEY, JSON.stringify(value))
  } catch {
  }
}

interface StoryFiltersProps {
  value: StoryFilterState
  onChange: (value: StoryFilterState) => void
  universes: StoryGroup[]
  availableTags: string[]
}

export function activeFilterCount(f: StoryFilterState): number {
  let count = 0

  if (f.status !== 'all') count++

  if (f.groupId !== null) count++

  if (f.tag !== null) count++

  return count
}

export function hasCustomFilters(f: StoryFilterState): boolean {
  return f.status !== DEFAULT_FILTERS.status || f.groupId !== DEFAULT_FILTERS.groupId || f.tag !== DEFAULT_FILTERS.tag
}

function StoryFilters({ value, onChange, universes, availableTags }: StoryFiltersProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const count = activeFilterCount(value)
  const hasActive = hasCustomFilters(value)

  function reset() {
    onChange(DEFAULT_FILTERS)
    setOpen(false)
  }

  return (
    <div className="flex items-center">
      <div className="relative" ref={ref}>
        <button
          className={`btn btn-sm gap-2 px-4 ${open || count > 0 ? 'btn-secondary' : 'btn-outline'}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4-2A1 1 0 018 15v-4.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
          Фильтры
          {count > 0 && (
            <span className="badge badge-sm border border-secondary-content bg-secondary-content text-secondary">
              {count}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute left-0 top-full z-30 mt-2 w-[calc(100vw-2rem)] max-w-[30rem] rounded-lg border border-base-content/10 bg-base-100 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold text-base-content">Фильтры</span>
              {hasActive && (
                <button className="btn btn-ghost btn-sm text-error" onClick={reset}>
                  Сбросить
                </button>
              )}
            </div>

            <div className="mb-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-base-content/50">Статус</p>
              <StoryFilterTabs
                value={value.status}
                onChange={(status) => onChange({ ...value, status })}
              />
            </div>

            {universes.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-base-content/50">Вселенная</p>
                <select
                  className="select select-bordered select-sm w-full"
                  value={value.groupId ?? ''}
                  onChange={(e) => onChange({ ...value, groupId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Все вселенные</option>
                  {universes.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}

            {availableTags.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-base-content/50">Категория</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      className={`btn btn-sm ${value.tag === tag ? 'btn-secondary' : 'btn-outline'}`}
                      onClick={() => onChange({ ...value, tag: value.tag === tag ? null : tag })}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default StoryFilters
