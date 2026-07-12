import { z } from 'zod'

export const TopicNudgeInputSchema = z.object({
  id: z.number(),
  title: z.string(),
  note: z.string().nullable(),
  universeId: z.number().nullable(),
  usedCount: z.number(),
})

export type TopicNudgeInput = z.infer<typeof TopicNudgeInputSchema>

export const NudgeCandidateSchema = z.object({
  keyword: z.string(),
  topicIds: z.array(z.number()),
  titles: z.array(z.string()),
  count: z.number(),
})

export type NudgeCandidate = z.infer<typeof NudgeCandidateSchema>

export interface ComputeTopicNudgesOptions {
  threshold?: number
}

const DEFAULT_THRESHOLD = 3

const MIN_TOKEN_LENGTH = 4

const MIN_STEM_LENGTH = 3

const STOPWORDS = new Set<string>([
  'когда',
  'чтобы',
  'потому',
  'который',
  'которая',
  'которое',
  'которые',
  'которых',
  'просто',
  'очень',
  'нужно',
  'надо',
  'если',
  'тоже',
  'также',
  'этот',
  'этого',
  'этому',
  'этом',
  'эта',
  'эти',
  'того',
  'тому',
  'него',
  'неё',
  'чего',
  'тебя',
  'меня',
  'себя',
  'быть',
  'было',
  'были',
  'есть',
  'сколько',
  'сейчас',
  'здесь',
  'там',
  'тут',
  'потом',
  'снова',
  'опять',
  'даже',
  'ещё',
  'уже',
  'между',
  'через',
  'после',
  'перед',
  'около',
  'своё',
  'свой',
  'своя',
  'свои',
])

const SUFFIXES = [
  'ость',
  'ями',
  'ами',
  'ому',
  'ему',
  'ого',
  'его',
  'ыми',
  'ими',
  'ах',
  'ях',
  'ов',
  'ев',
  'ый',
  'ий',
  'ой',
  'ая',
  'яя',
  'ое',
  'ее',
  'ые',
  'ие',
  'ым',
  'им',
  'ом',
  'ем',
  'ух',
  'юх',
  'а',
  'я',
  'о',
  'е',
  'и',
  'ы',
  'у',
  'ю',
]

function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 0)
}

function stem(token: string): string {
  for (const suffix of SUFFIXES) {
    if (token.length - suffix.length >= MIN_STEM_LENGTH && token.endsWith(suffix)) {
      return token.slice(0, token.length - suffix.length)
    }
  }

  return token
}

function surfaceTokens(topic: TopicNudgeInput): string[] {
  const combined = topic.note ? `${topic.title} ${topic.note}` : topic.title

  return normalizeText(combined).filter((token) => token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token))
}

function pickKeyword(surfaces: Map<string, number>): string {
  const entries = Array.from(surfaces.entries())

  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]

    if (a[0].length !== b[0].length) return a[0].length - b[0].length

    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
  })

  return entries[0]![0]
}

export function computeTopicNudges(
  topics: TopicNudgeInput[],
  opts?: ComputeTopicNudgesOptions,
): NudgeCandidate[] {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD

  const eligible = topics.filter((topic) => topic.usedCount === 0)

  const stemToTopicIds = new Map<string, Set<number>>()
  const stemToSurfaces = new Map<string, Map<string, number>>()
  const titleById = new Map<number, string>()

  for (const topic of eligible) {
    titleById.set(topic.id, topic.title)

    const seenStems = new Set<string>()

    for (const surface of surfaceTokens(topic)) {
      const stemValue = stem(surface)

      let ids = stemToTopicIds.get(stemValue)

      if (!ids) {
        ids = new Set<number>()
        stemToTopicIds.set(stemValue, ids)
      }

      ids.add(topic.id)

      let surfaces = stemToSurfaces.get(stemValue)

      if (!surfaces) {
        surfaces = new Map<string, number>()
        stemToSurfaces.set(stemValue, surfaces)
      }

      if (!seenStems.has(stemValue)) {
        surfaces.set(surface, (surfaces.get(surface) ?? 0) + 1)
        seenStems.add(stemValue)
      }
    }
  }

  const candidates: NudgeCandidate[] = []

  for (const [stemValue, ids] of stemToTopicIds.entries()) {
    if (ids.size < threshold) continue

    const topicIds = Array.from(ids).sort((a, b) => a - b)
    const keyword = pickKeyword(stemToSurfaces.get(stemValue)!)
    const titles = topicIds.map((id) => titleById.get(id)!)

    candidates.push({ keyword, topicIds, titles, count: topicIds.length })
  }

  candidates.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count

    return a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0
  })

  return candidates
}
