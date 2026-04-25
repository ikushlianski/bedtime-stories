import type { UsdMicros } from '@bedtime/shared/money/micros'

export interface StoryCallsRow {
  storyId: number
  callUsdMicros: UsdMicros[]
}

export interface FreeTierCompletionRate {
  rate: number
  freeOnlyStoryCount: number
  totalStoryCount: number
}

export function deriveFreeTierCompletionRate(rows: StoryCallsRow[]): FreeTierCompletionRate {
  if (rows.length === 0) {
    return { rate: 0, freeOnlyStoryCount: 0, totalStoryCount: 0 }
  }

  let freeOnly = 0

  for (const row of rows) {
    if (row.callUsdMicros.length === 0) continue
    if (row.callUsdMicros.every((u) => u === 0)) freeOnly += 1
  }

  return {
    rate: freeOnly / rows.length,
    freeOnlyStoryCount: freeOnly,
    totalStoryCount: rows.length,
  }
}
