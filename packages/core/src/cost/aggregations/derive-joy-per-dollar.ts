import type { UsdMicros } from '@bedtime/shared/money/micros'

export interface JoyPerDollarStoryRow {
  storyId: number
  models: string[]
  parentRating: number | null
  childEnjoyed: number | null
  totalUsdMicros: UsdMicros
}

export interface JoyPerDollarPerModel {
  model: string
  avgJoyPerMicro: number | null
  sampleSize: number
}

export function deriveJoyPerDollar(rows: JoyPerDollarStoryRow[]): JoyPerDollarPerModel[] {
  const perModel = new Map<string, { sum: number; count: number }>()

  for (const row of rows) {
    if (row.parentRating === null || row.childEnjoyed === null) continue
    if (row.totalUsdMicros === 0) continue

    const joyPerMicro = (row.parentRating + row.childEnjoyed) / row.totalUsdMicros

    for (const model of row.models) {
      const entry = perModel.get(model) ?? { sum: 0, count: 0 }
      entry.sum += joyPerMicro
      entry.count += 1
      perModel.set(model, entry)
    }
  }

  return Array.from(perModel.entries())
    .map(([model, { sum, count }]) => ({
      model,
      avgJoyPerMicro: count === 0 ? null : sum / count,
      sampleSize: count,
    }))
    .sort((a, b) => a.model.localeCompare(b.model))
}
