import type { UsdMicros } from '@bedtime/shared/money/micros'

export interface StoriesTableInputRow {
  storyId: number
  title: string
  createdAt: Date | null
  modelsPerStage: Record<string, string | null>
  totalTokens: number
  totalUsdMicros: UsdMicros | null
  parentRating: number | null
  childRating: number | null
}

export interface StoriesTableEntry {
  storyId: number
  title: string
  date: string | null
  modelsPerStage: Record<string, string | null>
  totalTokens: number
  totalUsdMicros: UsdMicros | null
  parentRating: number | null
  childRating: number | null
  joyPerMicro: number | null
}

export function deriveStoriesTable(rows: StoriesTableInputRow[]): StoriesTableEntry[] {
  return rows.map((r) => {
    const ratingsPresent = r.parentRating !== null && r.childRating !== null
    const usdPositive = r.totalUsdMicros !== null && r.totalUsdMicros > 0
    const joyPerMicro =
      ratingsPresent && usdPositive ? (r.parentRating! + r.childRating!) / r.totalUsdMicros! : null

    return {
      storyId: r.storyId,
      title: r.title,
      date: r.createdAt ? r.createdAt.toISOString().slice(0, 10) : null,
      modelsPerStage: r.modelsPerStage,
      totalTokens: r.totalTokens,
      totalUsdMicros: r.totalUsdMicros,
      parentRating: r.parentRating,
      childRating: r.childRating,
      joyPerMicro,
    }
  })
}
