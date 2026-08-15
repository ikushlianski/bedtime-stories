import { z } from 'zod'

export const CharacterBibleEntrySchema = z.object({
  name: z.string(),
  age: z.string().nullish(),
  setting: z.string().nullish(),
  traits: z.string().nullish(),
  relationships: z.string().nullish(),
  coOccurrenceNote: z.string().nullish(),
  description: z.string().nullish(),
  importance: z.number().int().min(1).max(5).nullish(),
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

  return [`- ${entry.name.trim()}`, ...lines].join('\n')
}

export function buildCharacterBibleBlock(characters: CharacterBibleEntry[]): string {
  if (!characters.some(hasStructuredField)) {
    return ''
  }

  const sorted = [...characters].sort((a, b) => (b.importance ?? 3) - (a.importance ?? 3))
  const roster = sorted.map(renderCharacter).join('\n')

  return [
    '\n\n---',
    'БИБЛИЯ ПЕРСОНАЖЕЙ ВСЕЛЕННОЙ (строгий состав — это канон, его нельзя ослабить; отсортировано по важности):',
    roster,
    '',
    'ЖЁСТКОЕ ПРАВИЛО (обязательно к соблюдению):',
    '- Бери ТОЛЬКО персонажей из этого списка. Не вводи новых ИМЕНОВАННЫХ, повторяющихся персонажей, если только их прямо не вводит сид истории.',
    '- Строго соблюдай возраст и место/группу каждого персонажа: не помещай персонажа туда, где по возрасту или по месту действия его быть не может (садиковский одногруппник не оказывается на семейном ужине, грудничок не рассуждает как школьник).',
    '- Соблюдай заметки о совместном присутствии: кто с кем реально может или не может быть в одной сцене.',
    '- Уважай ВАЖНОСТЬ персонажа: персонажи 4-5 — это ядро вселенной, их можно звать часто; персонажи 1-2 — редкие камео, не вставляй их в каждую историю только потому, что они есть в библии — их редкость и есть часть их характера.',
    '- РАЗРЕШЕНО: безымянные фоновые фигуры (проезжающий водитель автобуса, безымянный продавец в магазине) — они не входят в библию и не считаются нарушением. Запрещены только именованные, повторяющиеся персонажи вне этого списка.',
    '---\n',
  ].join('\n')
}
