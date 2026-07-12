import { z } from 'zod'

export const REACTION_WINDOW = 20
export const MIN_REACTIONS = 3
export const TOP_CHARACTERS_N = 2
export const RECENT_MOMENTS_M = 3
export const FUNNY_FLAG = 0.5
export const WANT_AGAIN_FLAG = 0.5
export const SCARY_FLAG = 0.34
export const TOO_LONG_FLAG = 0.4

export const ReactionRowSchema = z.object({
  enjoyed: z.number().nullable(),
  wasFunny: z.boolean().nullable(),
  wasScary: z.boolean().nullable(),
  tooLong: z.boolean().nullable(),
  wantAgain: z.boolean().nullable(),
  favoriteMoment: z.string().nullable(),
  favoriteCharacter: z.string().nullable(),
})

export type ReactionRow = z.infer<typeof ReactionRowSchema>

export const ReactionSummarySchema = z.object({
  sampleSize: z.number(),
  topFavoriteCharacters: z.array(z.string()),
  recentFavoriteMoments: z.array(z.string()),
  funnyLanded: z.boolean(),
  wantAgainStrong: z.boolean(),
  tooScary: z.boolean(),
  tooLong: z.boolean(),
})

export type ReactionSummary = z.infer<typeof ReactionSummarySchema>

function proportionMeets(
  rows: ReactionRow[],
  pick: (row: ReactionRow) => boolean | null,
  threshold: number,
): boolean {
  const rated = rows.map(pick).filter((value): value is boolean => value !== null)

  if (rated.length === 0) {
    return false
  }

  const trueCount = rated.filter((value) => value).length

  return trueCount / rated.length >= threshold
}

function rankFavoriteCharacters(rows: ReactionRow[]): string[] {
  const order: string[] = []
  const counts = new Map<string, number>()
  const display = new Map<string, string>()

  for (const row of rows) {
    const raw = row.favoriteCharacter?.trim()

    if (!raw) {
      continue
    }

    const key = raw.toLowerCase()

    if (!counts.has(key)) {
      counts.set(key, 0)
      display.set(key, raw)
      order.push(key)
    }

    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return order
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, TOP_CHARACTERS_N)
    .map((key) => display.get(key) as string)
}

function collectRecentMoments(rows: ReactionRow[]): string[] {
  const moments: string[] = []

  for (const row of rows) {
    const raw = row.favoriteMoment?.trim()

    if (!raw) {
      continue
    }

    moments.push(raw)

    if (moments.length >= RECENT_MOMENTS_M) {
      break
    }
  }

  return moments
}

export function summarizeReactions(rows: ReactionRow[]): ReactionSummary {
  return {
    sampleSize: rows.length,
    topFavoriteCharacters: rankFavoriteCharacters(rows),
    recentFavoriteMoments: collectRecentMoments(rows),
    funnyLanded: proportionMeets(rows, (row) => row.wasFunny, FUNNY_FLAG),
    wantAgainStrong: proportionMeets(rows, (row) => row.wantAgain, WANT_AGAIN_FLAG),
    tooScary: proportionMeets(rows, (row) => row.wasScary, SCARY_FLAG),
    tooLong: proportionMeets(rows, (row) => row.tooLong, TOO_LONG_FLAG),
  }
}

export function buildReactionPreferenceBlock(summary: ReactionSummary): string {
  if (summary.sampleSize < MIN_REACTIONS) {
    return ''
  }

  const lines: string[] = [
    '\n\n---',
    'ЧТО ЭТОТ РЕБЁНОК ЛЮБИЛ В ПРЕДЫДУЩИХ ИСТОРИЯХ ЭТОЙ ВСЕЛЕННОЙ (по реальным реакциям родителя): опирайся на это как на ориентир, не копируй буквально.',
  ]

  if (summary.topFavoriteCharacters.length > 0) {
    lines.push(
      `Любимые персонажи ребёнка: ${summary.topFavoriteCharacters.join(', ')}. Дай хотя бы одному из них настоящую роль в этой истории, когда это уместно.`,
      'ГРАНИЦА (важно): бери ТОЛЬКО тех персонажей, кто по канону и по месту действия реально может здесь оказаться. Не притягивай любимого персонажа в сцену, где его быть не может, ради того чтобы угодить.',
    )
  }

  if (summary.recentFavoriteMoments.length > 0) {
    lines.push(
      'Моменты, которые особенно зашли ребёнку раньше (придумай сцены в похожем духе, но не повторяй дословно):',
      ...summary.recentFavoriteMoments.map((moment) => `- ${moment}`),
    )
  }

  if (summary.funnyLanded || summary.wantAgainStrong) {
    lines.push(
      'Юмор с этим ребёнком работает — планируй раздел МОМЕНТЫ СМЕХА увереннее, смешных мест не бойся.',
    )
  }

  if (summary.tooScary) {
    lines.push(
      'Прошлые истории пугали — сделай ЭМОЦИОНАЛЬНУЮ ЗАДАЧУ мягче, ставки спокойнее, без резких страшных поворотов.',
    )
  }

  if (summary.tooLong) {
    lines.push(
      'Прошлые истории были длинноваты — держи компактно, ближе к нижней границе диапазона в 5–7 сцен, без сцен-наполнителей.',
    )
  }

  lines.push('---\n')

  return lines.join('\n')
}
