export interface ModelCallRow {
  stage: string
  modelId: string | null
  attempt: number
  tokensIn: number | null
  tokensOut: number | null
  usd: string | number
  createdAt: Date | null
}

export interface PerStageCost {
  stage: string
  model: string
  attempt: number
  tokensIn: number
  tokensOut: number
  usd: number
}

export interface StoryCostBreakdown {
  totalUsd: number
  perStage: PerStageCost[]
}

function toNumber(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  return typeof v === 'string' ? parseFloat(v) : v
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
    usd: toNumber(r.usd),
  }))

  const totalUsd = perStage.reduce((acc, r) => acc + r.usd, 0)

  return { totalUsd, perStage }
}
