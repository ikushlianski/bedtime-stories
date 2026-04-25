import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { formatMicros, MICROS_PER_USD } from '@bedtime/shared/money/micros'

interface Row {
  storyId: number
  title: string
  date: string | null
  modelsPerStage: Record<string, string | null>
  totalTokens: number
  totalUsdMicros: number | null
  parentRating: number | null
  childRating: number | null
  joyPerMicro: number | null
}

type SortKey = 'date' | 'totalUsdMicros' | 'totalTokens' | 'parentRating' | 'joyPerMicro'

export default function AdminStoriesTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    api.admin.storiesTable().then(setRows).finally(() => setLoading(false))
  }, [])

  const sorted = useMemo(() => {
    return rows.slice().sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const an = av === null ? -Infinity : typeof av === 'string' ? Date.parse(av) : av
      const bn = bv === null ? -Infinity : typeof bv === 'string' ? Date.parse(bv) : bv
      return sortDir === 'asc' ? an - bn : bn - an
    })
  }, [rows, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  if (loading) return <p className="text-sm text-base-content/60">Загрузка…</p>

  function header(key: SortKey, label: string) {
    return (
      <th className="cursor-pointer select-none" onClick={() => toggleSort(key)}>
        {label}{sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </th>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-xs">
        <thead>
          <tr>
            <th>Название</th>
            {header('date', 'Дата')}
            <th>Модели</th>
            {header('totalTokens', 'Токены')}
            {header('totalUsdMicros', 'USD')}
            {header('parentRating', 'Родитель')}
            <th>Ребёнок</th>
            {header('joyPerMicro', 'Радость/$')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.storyId}>
              <td className="max-w-xs truncate">{r.title}</td>
              <td>{r.date ?? '—'}</td>
              <td className="text-xs font-mono">
                {Object.entries(r.modelsPerStage)
                  .filter(([, m]) => m)
                  .map(([s, m]) => `${s}:${m}`)
                  .join(' ')}
              </td>
              <td>{r.totalTokens || '—'}</td>
              <td>{r.totalUsdMicros === null ? '—' : `$${formatMicros(r.totalUsdMicros)}`}</td>
              <td>{r.parentRating ?? '—'}</td>
              <td>{r.childRating ?? '—'}</td>
              <td>{r.joyPerMicro === null ? '—' : (r.joyPerMicro * MICROS_PER_USD).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
