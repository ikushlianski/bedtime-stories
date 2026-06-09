import { eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { fragments, storyFragments, stories } from '../db/schema'

export interface EligibleFragment {
  id: number
  text: string
  rank: number
  usedCount: number
}

export const MAX_FRAGMENTS_PER_STORY = 3

export async function loadEligibleFragments(
  universeId: number | null,
  limit: number = 12,
): Promise<EligibleFragment[]> {
  const scopeFilter = universeId !== null
    ? or(isNull(fragments.universeId), eq(fragments.universeId, universeId))
    : isNull(fragments.universeId)

  const usedCount = sql<number>`(
    select count(distinct ${storyFragments.storyId})::int from ${storyFragments}
    join ${stories} on ${stories.id} = ${storyFragments.storyId}
    where ${storyFragments.fragmentId} = ${fragments.id}
      and ${stories.status} in ('proofreading', 'ready', 'read')
  )`

  const rows = await db
    .select({
      id: fragments.id,
      text: fragments.text,
      rank: fragments.rank,
      usedCount,
    })
    .from(fragments)
    .where(scopeFilter)
    .orderBy(usedCount, sql`${fragments.rank} desc`, sql`random()`)
    .limit(limit)

  return rows
}

export function buildFragmentsBlock(items: EligibleFragment[]): string {
  if (items.length === 0) return ''

  const lines = items.map((f) => {
    const usedTag = f.usedCount > 0 ? ' (уже использован ранее)' : ''
    return `[Фрагмент #${f.id}${usedTag}] ${f.text}`
  })

  return [
    '\n\n---',
    'ФРАГМЕНТЫ (необязательные вставки от родителя — забавные, тёплые или поучительные детали, которые он хотел бы иногда видеть в историях):',
    lines.join('\n'),
    '',
    'Правила работы с фрагментами:',
    `- Можешь вплести от нуля до ${MAX_FRAGMENTS_PER_STORY} фрагментов в одну историю. Обычно меньше — не набивай историю фрагментами. Ни одного — тоже нормальный и частый выбор.`,
    '- Бери фрагмент ТОЛЬКО если он органично ложится на затравку. Никогда не перестраивай сюжет вокруг фрагмента — это лёгкие детали, а не ось истории.',
    '- Фрагмент может быть как короткой фразой/образом, который вплетается в готовую сцену, так и маленьким моментом, под который ты закладываешь крошечный повод в плане.',
    '- Фрагмент, помеченный «(уже использован ранее)», бери лишь в редком случае — как намеренную отсылку-рефрен, если он идеально подходит. По умолчанию предпочитай новые.',
    '- В САМОМ КОНЦЕ ответа, отдельной последней строкой, выведи: «ФРАГМЕНТЫ: <id выбранных фрагментов через запятую или слово нет>». Эта строка служебная.',
    '---\n',
  ].join('\n')
}

export interface FragmentMarkerResult {
  cleanedText: string
  fragmentIds: number[]
}

export function extractFragmentMarkers(text: string): FragmentMarkerResult {
  const match = text.match(/^[ \t>*#-]*ФРАГМЕНТ(?:Ы)?\s*[:—-]?\s*([^\n]*)$/im)

  if (!match) return { cleanedText: text, fragmentIds: [] }

  const payload = match[1] ?? ''
  const ids = Array.from(payload.matchAll(/#?\s*(\d+)/g)).map((m) => Number(m[1]))
  const fragmentIds = Array.from(new Set(ids))
  const cleanedText = text.replace(match[0], '').replace(/\n{3,}$/, '\n').trimEnd()

  return { cleanedText, fragmentIds }
}

export async function loadFragmentTexts(fragmentIds: number[]): Promise<string[]> {
  if (fragmentIds.length === 0) return []

  const rows = await db
    .select({ id: fragments.id, text: fragments.text })
    .from(fragments)
    .where(inArray(fragments.id, fragmentIds))

  const byId = new Map(rows.map((r) => [r.id, r.text]))

  return fragmentIds.map((id) => byId.get(id)).filter((t): t is string => t !== undefined)
}

export async function loadStoryFragmentTexts(storyId: number): Promise<string[]> {
  const rows = await db
    .select({ text: fragments.text })
    .from(storyFragments)
    .innerJoin(fragments, eq(fragments.id, storyFragments.fragmentId))
    .where(eq(storyFragments.storyId, storyId))

  return rows.map((r) => r.text)
}

export async function recordStoryFragments(storyId: number, fragmentIds: number[]): Promise<void> {
  if (fragmentIds.length === 0) return

  await db
    .insert(storyFragments)
    .values(fragmentIds.map((fragmentId) => ({ storyId, fragmentId })))
    .onConflictDoNothing()
}
