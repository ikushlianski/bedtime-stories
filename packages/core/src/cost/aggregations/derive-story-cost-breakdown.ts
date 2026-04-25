import type { UsdMicros } from '@bedtime/shared/money/micros'

export interface ModelCallRow {
  stage: string
  modelId: string | null
  attempt: number
  tokensIn: number | null
  tokensOut: number | null
  usdMicros: UsdMicros
  createdAt: Date | null
}

export interface PerStageCost {
  stage: string
  model: string
  attempt: number
  tokensIn: number
  tokensOut: number
  usdMicros: UsdMicros
}

export interface StoryCostBreakdown {
  totalUsdMicros: UsdMicros
  perStage: PerStageCost[]
}

export function deriveStoryCostBreakdown(rows: ModelCallRow[]): StoryCostBreakdown {
  const sorted = rows.slice().sort((a, b) => {
    const aT = a.createdAt?.getTime() ?? 0
    const bT = b.createdAt?.getTime() ?? 0
    return aT - bT
  })

  const perStage = sorted.map((r) => ({
    stage: r.stage,
    model: r.modelId ?? 'unknown',
    attempt: r.attempt,
    tokensIn: r.tokensIn ?? 0,
    tokensOut: r.tokensOut ?? 0,
    usdMicros: r.usdMicros,
  }))

  const totalUsdMicros = perStage.reduce((acc, r) => acc + r.usdMicros, 0)

  return { totalUsdMicros, perStage }
}
