import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { formatMicros } from '@bedtime/shared/money/micros'

interface DailyEntry {
  date: string
  totalUsdMicros: number
  perModel: Array<{ model: string; usdMicros: number }>
}

export default function AdminSpendChart() {
  const [data, setData] = useState<DailyEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.admin.spendOverTime()
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-base-content/60">Загрузка…</p>
  if (data.length === 0) return <p className="text-sm text-base-content/60">Расходов в этом месяце пока нет.</p>

  const maxMicros = Math.max(...data.map((d) => d.totalUsdMicros), 1)
  const totalMicros = data.reduce((a, d) => a + d.totalUsdMicros, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-32 border-b border-l border-base-300 pl-2 pb-1">
        {data.map((d) => (
          <div
            key={d.date}
            className="flex-1 bg-primary/60 rounded-t hover:bg-primary transition-colors"
            style={{ height: `${(d.totalUsdMicros / maxMicros) * 100}%` }}
            title={`${d.date}: $${formatMicros(d.totalUsdMicros)}`}
          />
        ))}
      </div>
      <div className="text-xs text-base-content/60">
        Макс. за день: ${formatMicros(maxMicros)} • Всего за период: ${formatMicros(totalMicros)}
      </div>
    </div>
  )
}
