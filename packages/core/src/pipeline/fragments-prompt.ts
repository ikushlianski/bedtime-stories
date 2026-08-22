export interface EligibleFragment {
  id: number
  text: string
  rank: number
  usedCount: number
  exactQuote: boolean
}

export const MAX_FRAGMENTS_PER_STORY = 3

export function buildFragmentsBlock(items: EligibleFragment[]): string {
  if (items.length === 0) return ''

  const lines = items.map((f) => {
    const usedTag = f.usedCount > 0 ? ' (уже использован ранее)' : ''
    const quoteTag = f.exactQuote ? ' (ДОСЛОВНАЯ ЦИТАТА)' : ''
    return `[Фрагмент #${f.id}${quoteTag}${usedTag}] ${f.text}`
  })

  const hasExactQuotes = items.some((f) => f.exactQuote)
  const exactQuoteRule = hasExactQuotes
    ? '\n- Фрагмент, помеченный «(ДОСЛОВНАЯ ЦИТАТА)», — это точная фраза, которую родитель хочет увидеть в тексте СЛОВО В СЛОВО, без пересказа, сокращения или замены синонимами. Если берёшь такой фрагмент, вставь его целиком как есть (например, репликой персонажа или отдельным предложением рассказчика) — не превращай его в описание похожего события своими словами.'
    : ''

  return [
    '\n\n---',
    'ФРАГМЕНТЫ (необязательные вставки от родителя — забавные, тёплые или поучительные детали, которые он хотел бы иногда видеть в историях):',
    lines.join('\n'),
    '',
    'Правила работы с фрагментами:',
    `- Можешь вплести от нуля до ${MAX_FRAGMENTS_PER_STORY} фрагментов в одну историю. Обычно меньше — не набивай историю фрагментами. Ни одного — тоже нормальный и частый выбор.`,
    '- Фрагмент нужно вплетать умело и тщательно, так, чтобы он выглядел естественной частью сюжета, а не приклеенной вставкой. Никогда не перестраивай сюжет вокруг фрагмента — это лёгкие детали, а не ось истории.',
    '- Прежде чем взять фрагмент, мысленно попробуй 3–5 разных способов вплести его в канву сюжета и выбери самый органичный. Если ни один вариант не ложится и по здравому смыслу фрагмент выглядит неуместно — НЕ вставляй его вовсе. Ноль фрагментов лучше, чем один притянутый за уши.',
    '- Не хватайся за первые попавшиеся или самые свежие фрагменты. Просмотри весь список и бери те, что реально подходят именно этой истории, — стремись к разнообразию, а не к повторному использованию одних и тех же.',
    '- Фрагмент, помеченный «(уже использован ранее)», можно взять повторно, если раньше он хорошо заходил и снова идеально к месту — но один и тот же фрагмент не стоит пускать в дело больше двух-трёх раз за всё время.' + exactQuoteRule,
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
