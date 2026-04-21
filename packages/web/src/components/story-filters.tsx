import { useState, useRef, useEffect } from 'react'
import { z } from 'zod'
import type { StoryGroup } from '../lib/api'
import StoryFilterTabs from './story-filter-tabs'

export type StatusFilter = 'all' | 'draft' | 'ready' | 'read' | 'archived'
export type ReadSort = 'default' | 'newest_read' | 'oldest_read'

export interface StoryFilterState {
  status: StatusFilter
  groupId: number | null
  tag: string | null
  readSort: ReadSort
}

export const DEFAULT_FILTERS: StoryFilterState = {
  status: 'ready',
  groupId: null,
  tag: null,
  readSort: 'default',
}

const STORED_FILTERS_KEY = 'story-list-filters-v1'

const storedFiltersSchema = z.object({
  status: z.enum(['all', 'draft', 'ready', 'read', 'archived']),
  groupId: z.number().int().nullable(),
  tag: z.string().nullable(),
  readSort: z.enum(['default', 'newest_read', 'oldest_read']).default('default'),
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

  if (f.readSort !== 'default') count++

  return count
}

export function hasCustomFilters(f: StoryFilterState): boolean {
  return (
    f.status !== DEFAULT_FILTERS.status ||
    f.groupId !== DEFAULT_FILTERS.groupId ||
    f.tag !== DEFAULT_FILTERS.tag ||
    f.readSort !== DEFAULT_FILTERS.readSort
  )
}

const statusLabels: Record<StatusFilter, string> = {
  all: 'Все',
  draft: 'Черновики',
  ready: 'Готовые',
  read: 'Прочитанные',
  archived: 'Архив',
}

const readSortLabels: Record<ReadSort, string> = {
  default: 'По дате',
  newest_read: 'Недавно читалось',
  oldest_read: 'Давно читалось',
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-content">
      {label}
      <button
        type="button"
        className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-secondary-content/60 hover:bg-secondary-content/20 hover:text-secondary-content"
        onClick={onRemove}
        aria-label={`Убрать фильтр "${label}"`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </span>
  )
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
  const activeUniverse = value.groupId !== null ? universes.find((u) => u.id === value.groupId) : null

  function reset() {
    onChange(DEFAULT_FILTERS)
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
              <div className="mb-4">
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

            {value.status === 'read' && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-base-content/50">Сортировка по прочтению</p>
                <div className="join flex">
                  {(['default', 'newest_read', 'oldest_read'] as ReadSort[]).map((sort) => (
                    <button
                      key={sort}
                      className={`btn join-item btn-sm whitespace-nowrap ${value.readSort === sort ? 'btn-secondary' : 'btn-outline'}`}
                      onClick={() => onChange({ ...value, readSort: sort })}
                    >
                      {readSortLabels[sort]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {value.status !== 'all' && (
        <FilterChip
          label={statusLabels[value.status]}
          onRemove={() => onChange({ ...value, status: 'all' })}
        />
      )}

      {activeUniverse && (
        <FilterChip
          label={activeUniverse.name}
          onRemove={() => onChange({ ...value, groupId: null })}
        />
      )}

      {value.tag !== null && (
        <FilterChip
          label={`#${value.tag}`}
          onRemove={() => onChange({ ...value, tag: null })}
        />
      )}

      {value.readSort !== 'default' && (
        <FilterChip
          label={readSortLabels[value.readSort]}
          onRemove={() => onChange({ ...value, readSort: 'default' })}
        />
      )}
    </div>
  )
}

export default StoryFilters
