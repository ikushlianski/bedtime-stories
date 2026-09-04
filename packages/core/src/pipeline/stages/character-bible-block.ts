import { z } from 'zod'

export const CharacterBibleEntrySchema = z.object({
  id: z.number().int().nullish(),
  name: z.string(),
  age: z.string().nullish(),
  setting: z.string().nullish(),
  traits: z.string().nullish(),
  relationships: z.string().nullish(),
  coOccurrenceNote: z.string().nullish(),
  description: z.string().nullish(),
  importance: z.number().int().min(1).max(5).nullish(),
  usedCount: z.number().int().nullish(),
})

export type CharacterBibleEntry = z.infer<typeof CharacterBibleEntrySchema>

interface CharacterField {
  label: string
  value: string | null | undefined
}

function hasStructuredField(entry: CharacterBibleEntry): boolean {
  return [entry.age, entry.setting, entry.traits, entry.relationships, entry.coOccurrenceNote]
    .some((value) => typeof value === 'string' && value.trim().length > 0)
}

const IMPORTANCE_LABELS: Record<number, string> = {
  5: 'главный герой — появляется часто',
  4: 'частый персонаж',
  3: 'обычный персонаж',
  2: 'редкий персонаж',
  1: 'редкое камео — появляется изредка, для узнаваемости',
}

function renderCharacter(entry: CharacterBibleEntry): string {
  const importance = entry.importance ?? 3
  const usedCount = entry.usedCount ?? 0
  const usageTag = entry.id != null ? ` [#${entry.id}, использован в ${usedCount} готовых историях]` : ''
  const fields: CharacterField[] = [
    { label: 'Важность', value: `${importance}/5 — ${IMPORTANCE_LABELS[importance] ?? IMPORTANCE_LABELS[3]}` },
    { label: 'Возраст', value: entry.age },
    { label: 'Где/группа', value: entry.setting },
    { label: 'Черты', value: entry.traits },
    { label: 'Связи', value: entry.relationships },
    { label: 'С кем в сцене', value: entry.coOccurrenceNote },
    { label: 'Описание', value: entry.description },
  ]

  const lines = fields
    .filter((field) => typeof field.value === 'string' && field.value.trim().length > 0)
    .map((field) => `  - ${field.label}: ${(field.value as string).trim()}`)

  return [`- ${entry.name.trim()}${usageTag}`, ...lines].join('\n')
}

export function buildCharacterBibleBlock(characters: CharacterBibleEntry[], opts: { includeMarker?: boolean } = {}): string {
  const isOptedIn = characters.some(hasStructuredField) || characters.some((c) => c.id != null)
  if (!isOptedIn) {
    return ''
  }

  const includeMarker = opts.includeMarker ?? true

  const sorted = [...characters].sort((a, b) => {
    const importanceDiff = (b.importance ?? 3) - (a.importance ?? 3)
    if (importanceDiff !== 0) return importanceDiff
    return (a.usedCount ?? 0) - (b.usedCount ?? 0)
  })
  const roster = sorted.map(renderCharacter).join('\n')
  const hasUsageData = characters.some((c) => c.id != null)

  const fairnessRule = hasUsageData
    ? '\n- У каждого персонажа в скобках указано, в скольких готовых историях он уже появлялся. Уважай ВАЖНОСТЬ, но при прочих равных отдавай предпочтение персонажам с МЕНЬШИМ числом появлений — не бери одних и тех же персонажей из истории в историю только потому, что они самые важные или самые заметные в списке. Даже персонаж 4-5 важности не должен появляться в каждой подряд истории.'
    : ''

  return [
    '\n\n---',
    'БИБЛИЯ ПЕРСОНАЖЕЙ ВСЕЛЕННОЙ (строгий состав — это канон, его нельзя ослабить; отсортировано по важности, внутри уровня важности — по частоте использования):',
    roster,
    '',
    'ЖЁСТКОЕ ПРАВИЛО (обязательно к соблюдению):',
    '- Бери ТОЛЬКО персонажей из этого списка. Не вводи новых ИМЕНОВАННЫХ, повторяющихся персонажей, если только их прямо не вводит сид истории.',
    '- Строго соблюдай возраст и место/группу каждого персонажа: не помещай персонажа туда, где по возрасту или по месту действия его быть не может (садиковский одногруппник не оказывается на семейном ужине, грудничок не рассуждает как школьник).',
    '- Соблюдай заметки о совместном присутствии: кто с кем реально может или не может быть в одной сцене.',
    '- Уважай ВАЖНОСТЬ персонажа: персонажи 4-5 — это ядро вселенной, их МОЖНО звать часто, но это не значит, что их нужно звать в каждой истории; персонажи 1-2 — редкие камео, не вставляй их в каждую историю только потому, что они есть в библии — их редкость и есть часть их характера.' + fairnessRule,
    '- РАЗРЕШЕНО: безымянные фоновые фигуры (проезжающий водитель автобуса, безымянный продавец в магазине) — они не входят в библию и не считаются нарушением. Запрещены только именованные, повторяющиеся персонажи вне этого списка.',
    hasUsageData && includeMarker
      ? '- В САМОМ КОНЦЕ ответа, отдельной последней строкой, выведи: «ID_ПЕРСОНАЖЕЙ: <id выбранных персонажей из библии через запятую, например #3, #7, или слово нет, если ни один персонаж из библии не использован>». Эта строка служебная.'
      : '',
    '---\n',
  ].filter(Boolean).join('\n')
}

export interface CharacterMarkerResult {
  cleanedText: string
  characterIds: number[]
}

export function extractCharacterMarkers(text: string): CharacterMarkerResult {
  const match = text.match(/^[ \t>*#-]*ID[_ ]?ПЕРСОНАЖЕЙ\s*[:—-]?\s*([^\n]*)$/im)

  if (!match) return { cleanedText: text, characterIds: [] }

  const payload = match[1] ?? ''
  const ids = Array.from(payload.matchAll(/#?\s*(\d+)/g)).map((m) => Number(m[1]))
  const characterIds = Array.from(new Set(ids))
  const cleanedText = text.replace(match[0], '').replace(/\n{3,}$/, '\n').trimEnd()

  return { cleanedText, characterIds }
}
