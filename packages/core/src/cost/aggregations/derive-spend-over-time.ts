import type { UsdMicros } from '@bedtime/shared/money/micros'

export interface SpendCallRow {
  modelId: string | null
  usdMicros: UsdMicros
  createdAt: Date
}

export interface DailyPerModel {
  model: string
  usdMicros: UsdMicros
}

export interface DailySpendEntry {
  date: string
  totalUsdMicros: UsdMicros
  perModel: DailyPerModel[]
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function deriveSpendOverTime(rows: SpendCallRow[]): DailySpendEntry[] {
  const byDate = new Map<string, Map<string, number>>()

  for (const row of rows) {
    const key = toDateKey(row.createdAt)
    const model = row.modelId ?? 'unknown'

    let perModel = byDate.get(key)
    if (!perModel) {
      perModel = new Map()
      byDate.set(key, perModel)
    }

    perModel.set(model, (perModel.get(model) ?? 0) + row.usdMicros)
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, perModelMap]) => {
      const perModel = Array.from(perModelMap.entries())
        .map(([model, usdMicros]) => ({ model, usdMicros }))
        .sort((a, b) => a.model.localeCompare(b.model))
      const totalUsdMicros = perModel.reduce((acc, m) => acc + m.usdMicros, 0)
      return { date, totalUsdMicros, perModel }
    })
}
