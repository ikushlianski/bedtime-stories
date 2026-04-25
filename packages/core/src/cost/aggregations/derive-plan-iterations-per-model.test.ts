import { describe, it, expect } from 'vitest'
import { derivePlanIterationsPerModel, type PlanIterationsRow } from './derive-plan-iterations-per-model'

describe('derivePlanIterationsPerModel', () => {
  it('returns empty list for empty input', () => {
    expect(derivePlanIterationsPerModel([])).toEqual([])
  })

  it('skips rows with null plotterModel or planIterations', () => {
    const rows: PlanIterationsRow[] = [
      { storyId: 1, plotterModel: null, planIterations: 3 },
      { storyId: 2, plotterModel: 'm/p', planIterations: null },
    ]
    expect(derivePlanIterationsPerModel(rows)).toEqual([])
  })

  it('averages plan iterations per model', () => {
    const rows: PlanIterationsRow[] = [
      { storyId: 1, plotterModel: 'm/p', planIterations: 2 },
      { storyId: 2, plotterModel: 'm/p', planIterations: 4 },
      { storyId: 3, plotterModel: 'm/q', planIterations: 1 },
    ]
    const result = derivePlanIterationsPerModel(rows)

    expect(result).toEqual([
      { model: 'm/p', avgPlanIterations: 3, sampleSize: 2 },
      { model: 'm/q', avgPlanIterations: 1, sampleSize: 1 },
    ])
  })
})
