import { useEffect, useRef, useState, useMemo } from 'react'
import type { ModelCatalogEntry, ModelCategories } from '../lib/api'
import { flatModels, EMPTY_MODEL_CATEGORIES } from '../lib/api'

interface ModelSelectDropdownProps {
  categories: ModelCategories
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

type PriceDir = 'asc' | 'desc'

const SECTIONS: Array<{ key: keyof ModelCategories; label: string }> = [
  { key: 'popular', label: 'Популярные' },
  { key: 'free', label: 'Бесплатные' },
  { key: 'new', label: 'Новинки' },
  { key: 'temporary', label: 'Временные (preview)' },
]

function combinedPrice(m: ModelCatalogEntry): number {
  return parseFloat(m.inputUsdPerMillion ?? '0') + parseFloat(m.outputUsdPerMillion ?? '0')
}

function formatPrice(m: ModelCatalogEntry): string {
  if (m.isFree) return 'free'
  const input = parseFloat(m.inputUsdPerMillion ?? '0')
  const output = parseFloat(m.outputUsdPerMillion ?? '0')
  return `$${input.toFixed(2)}/$${output.toFixed(2)}/M`
}

export default function ModelSelectDropdown({
  categories = EMPTY_MODEL_CATEGORIES,
  value,
  onChange,
  placeholder = 'DeepSeek V4 Pro (по умолчанию)',
}: ModelSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [priceDir, setPriceDir] = useState<PriceDir>('asc')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const allFlat = useMemo(() => flatModels(categories), [categories])
  const selectedModel = allFlat.find((m) => m.id === value) ?? null

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open])

  const searchResults = useMemo(() => {
    if (!search) return []
    const q = search.toLowerCase()
    return allFlat
      .filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .sort((a, b) => {
        const diff = priceDir === 'asc'
          ? combinedPrice(a) - combinedPrice(b)
          : combinedPrice(b) - combinedPrice(a)
        return diff
      })
  }, [allFlat, search, priceDir])

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  function toggleOpen() {
    setOpen((prev) => !prev)
    if (open) setSearch('')
  }

  const triggerLabel = selectedModel
    ? `${selectedModel.name} · ${formatPrice(selectedModel)}`
    : value && !selectedModel
      ? value
      : placeholder

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="btn btn-sm btn-outline w-full justify-between text-left font-normal"
        onClick={toggleOpen}
      >
        <span className="truncate">{triggerLabel}</span>
        <span className="ml-1 shrink-0 opacity-50">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-96 w-full min-w-max overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-lg sm:w-80">
          <div className="space-y-2 p-2">
            <input
              ref={searchRef}
              type="text"
              className="input input-sm input-bordered w-full"
              placeholder="Поиск модели..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {search && (
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`btn btn-xs flex-1 ${priceDir === 'asc' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPriceDir('asc')}
                >
                  цена ↑
                </button>
                <button
                  type="button"
                  className={`btn btn-xs flex-1 ${priceDir === 'desc' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPriceDir('desc')}
                >
                  цена ↓
                </button>
              </div>
            )}
          </div>

          <ul className="max-h-64 overflow-y-auto">
            <li>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 ${value === '' ? 'bg-base-200 font-medium' : ''}`}
                onClick={() => handleSelect('')}
              >
                <span className="text-base-content/50 text-xs">↩ сбросить — {placeholder}</span>
              </button>
            </li>

            {search ? (
              <>
                {searchResults.map((m) => (
                  <ModelRow key={m.id} model={m} selected={value === m.id} onSelect={handleSelect} />
                ))}
                {searchResults.length === 0 && (
                  <li className="px-3 py-4 text-center text-sm text-base-content/40">Ничего не найдено</li>
                )}
              </>
            ) : (
              SECTIONS.map(({ key, label }) => {
                const items = categories[key]
                if (items.length === 0) return null
                return (
                  <li key={key}>
                    <div className="sticky top-0 bg-base-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                      {label}
                    </div>
                    <ul>
                      {items.map((m) => (
                        <ModelRow key={m.id} model={m} selected={value === m.id} onSelect={handleSelect} />
                      ))}
                    </ul>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function ModelRow({ model: m, selected, onSelect }: { model: ModelCatalogEntry; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-base-200 ${selected ? 'bg-base-200 font-medium' : ''}`}
        onClick={() => onSelect(m.id)}
      >
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate">{m.name}</span>
          {m.expirationDate && <span className="badge badge-warning badge-xs shrink-0">temp</span>}
        </div>
        <div className="mt-0.5 text-xs text-base-content/60">
          {formatPrice(m)}
          {m.contextLength ? ` · ${Math.round(m.contextLength / 1000)}k ctx` : ''}
        </div>
      </button>
    </li>
  )
}
