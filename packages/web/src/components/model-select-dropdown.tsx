import { useEffect, useRef, useState, useMemo } from 'react'
import type { ModelCatalogEntry } from '../lib/api'

interface ModelSelectDropdownProps {
  models: ModelCatalogEntry[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

type PriceDir = 'asc' | 'desc'

function formatPrice(usdPerMillion: string | null): string {
  if (!usdPerMillion) return 'free'
  const n = parseFloat(usdPerMillion)
  if (n === 0) return 'free'
  return `$${n.toFixed(2)}/Mtok`
}

function isPermanent(model: ModelCatalogEntry): boolean {
  return !model.expirationDate
}

export default function ModelSelectDropdown({
  models,
  value,
  onChange,
  placeholder = '— по умолчанию —',
}: ModelSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [priceDir, setPriceDir] = useState<PriceDir>('asc')
  const [permFirst, setPermFirst] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selectedModel = models.find((m) => m.id === value) ?? null

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const base = q ? models.filter((m) => m.name.toLowerCase().includes(q)) : models

    return base.slice().sort((a, b) => {
      const aPerm = isPermanent(a) ? 0 : 1
      const bPerm = isPermanent(b) ? 0 : 1
      const permDiff = permFirst ? aPerm - bPerm : bPerm - aPerm

      if (permDiff !== 0) return permDiff

      const aPrice = parseFloat(a.inputUsdPerMillion ?? '0')
      const bPrice = parseFloat(b.inputUsdPerMillion ?? '0')
      return priceDir === 'asc' ? aPrice - bPrice : bPrice - aPrice
    })
  }, [models, search, priceDir, permFirst])

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
    ? `${selectedModel.name} · ${formatPrice(selectedModel.inputUsdPerMillion)}`
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
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-box border border-base-300 bg-base-100 shadow-lg">
          <div className="space-y-2 p-2">
            <input
              ref={searchRef}
              type="text"
              className="input input-sm input-bordered w-full"
              placeholder="Поиск модели..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className={`btn btn-xs ${priceDir === 'asc' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPriceDir('asc')}
              >
                цена ↑
              </button>
              <button
                type="button"
                className={`btn btn-xs ${priceDir === 'desc' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPriceDir('desc')}
              >
                цена ↓
              </button>
              <button
                type="button"
                className={`btn btn-xs ${permFirst ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => setPermFirst((p) => !p)}
              >
                {permFirst ? 'постоянные ↑' : 'временные ↑'}
              </button>
            </div>
          </div>

          <ul className="max-h-64 overflow-y-auto">
            <li>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-base-200 ${value === '' ? 'bg-base-200 font-medium' : ''}`}
                onClick={() => handleSelect('')}
              >
                <span className="opacity-60">{placeholder}</span>
              </button>
            </li>

            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-base-200 ${value === m.id ? 'bg-base-200 font-medium' : ''}`}
                  onClick={() => handleSelect(m.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate">{m.name}</span>
                    {m.expirationDate ? (
                      <span className="badge badge-warning badge-xs">temp</span>
                    ) : (
                      <span className="badge badge-success badge-xs">perm</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex gap-3 text-xs text-base-content/60">
                    <span>in: {formatPrice(m.inputUsdPerMillion)}</span>
                    <span>out: {formatPrice(m.outputUsdPerMillion)}</span>
                  </div>
                </button>
              </li>
            ))}

            {filtered.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-base-content/40">
                Ничего не найдено
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
