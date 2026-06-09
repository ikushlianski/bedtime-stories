export interface EligibleFragment {
  id: number
  text: string
  rank: number
  usedCount: number
}

export const MAX_FRAGMENTS_PER_STORY = 3

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
