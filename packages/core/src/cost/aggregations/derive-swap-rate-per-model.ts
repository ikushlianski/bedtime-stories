export interface SwapEventRow {
  storyId: number
  fromModel: string | null
}

export interface StoryStageModelsRow {
  storyId: number
  models: string[]
}

export interface SwapRatePerModel {
  model: string
  swapsAway: number
  totalUses: number
  swapRate: number
}

export function deriveSwapRatePerModel(
  swapEvents: SwapEventRow[],
  storyStageModels: StoryStageModelsRow[],
): SwapRatePerModel[] {
  const usesByModel = new Map<string, number>()

  for (const row of storyStageModels) {
    const seen = new Set<string>()
    for (const m of row.models) {
      if (seen.has(m)) continue
      seen.add(m)
      usesByModel.set(m, (usesByModel.get(m) ?? 0) + 1)
    }
  }

  const swapsByModel = new Map<string, number>()

  for (const ev of swapEvents) {
    if (ev.fromModel === null) continue
    swapsByModel.set(ev.fromModel, (swapsByModel.get(ev.fromModel) ?? 0) + 1)
  }

  const allModels = new Set<string>([...usesByModel.keys(), ...swapsByModel.keys()])

  return Array.from(allModels)
    .map((model) => {
      const swapsAway = swapsByModel.get(model) ?? 0
      const totalUses = usesByModel.get(model) ?? 0
      const swapRate = totalUses === 0 ? 0 : swapsAway / totalUses
      return { model, swapsAway, totalUses, swapRate }
    })
    .sort((a, b) => a.model.localeCompare(b.model))
}
