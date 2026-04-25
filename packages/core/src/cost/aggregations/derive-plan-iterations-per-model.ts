export interface PlanIterationsRow {
  storyId: number
  plotterModel: string | null
  planIterations: number | null
}

export interface PlanIterationsPerModel {
  model: string
  avgPlanIterations: number
  sampleSize: number
}

export function derivePlanIterationsPerModel(rows: PlanIterationsRow[]): PlanIterationsPerModel[] {
  const perModel = new Map<string, { sum: number; count: number }>()

  for (const row of rows) {
    if (row.plotterModel === null) continue
    if (row.planIterations === null) continue

    const entry = perModel.get(row.plotterModel) ?? { sum: 0, count: 0 }
    entry.sum += row.planIterations
    entry.count += 1
    perModel.set(row.plotterModel, entry)
  }

  return Array.from(perModel.entries())
    .map(([model, { sum, count }]) => ({
      model,
      avgPlanIterations: sum / count,
      sampleSize: count,
    }))
    .sort((a, b) => a.model.localeCompare(b.model))
}
