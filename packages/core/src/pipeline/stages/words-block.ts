import { z } from 'zod'

export const targetWordSchema = z.object({
  id: z.number(),
  word: z.string(),
  hint: z.string().nullable(),
  rank: z.number(),
  usedCount: z.number(),
})

export type TargetWord = z.infer<typeof targetWordSchema>

export const MAX_WORDS_PER_STORY = 3

export function buildWordsBlock(words: TargetWord[]): string {
  if (words.length === 0) return ''

  const lines = words.map((w) => {
    const usedTag = w.usedCount > 0 ? ' (уже использовано ранее)' : ''
    const hintPart = w.hint && w.hint.trim().length > 0 ? ` — ${w.hint.trim()}` : ''
    return `[Слово #${w.id}${usedTag}] ${w.word}${hintPart}`
  })

  return [
    '\n\n---',
    'СЛОВА (целевые слова от родителя, которые он хотел бы, чтобы ребёнок постепенно усвоил):',
    lines.join('\n'),
    '',
    'Правила работы со словами:',
    `- Можешь вплести от нуля до ${MAX_WORDS_PER_STORY} целевых слов в одну историю. Обычно меньше. Ни одного — это нормальный, частый и хороший исход; чаще всего именно так.`,
    '- Бери слово ТОЛЬКО там, где оно ложится по смыслу естественно. Никогда не перестраивай сюжет вокруг слова и никогда не впихивай слово силой. Притянутое за уши слово хуже, чем пропущенное.',
    '- Каждое выбранное слово используй правильно и по-детски понятно — предложение должно раскрывать смысл слова так, чтобы семилетний ребёнок уловил его из контекста, без объяснений в лоб.',
    '- Стремись к разнообразию от истории к истории — не хватайся всё время за одни и те же слова.',
    '- В САМОМ КОНЦЕ ответа, отдельной последней строкой, обязательно выведи служебную строку: «СЛОВА: <через запятую перечисли те целевые слова из списка выше, которые ты действительно вплёл в историю, точно так же, как они написаны в списке; если ни одного — напиши: нет>». Эта строка будет удалена из готового текста.',
    '---\n',
  ].join('\n')
}

function normalizeToken(raw: string): string {
  return raw
    .replace(/^[«»"'`.,;:!?()#\s-]+/u, '')
    .replace(/[«»"'`.,;:!?()\s-]+$/u, '')
    .toLowerCase()
    .replace(/ё/g, 'е')
}

export interface WordMarkerResult {
  cleanedText: string
  wordIds: number[]
}

export function extractWordMarkers(text: string, words: TargetWord[] = []): WordMarkerResult {
  const lines = text.split('\n')

  let lastIdx = -1

  for (let i = lines.length - 1; i >= 0; i--) {
    if ((lines[i] ?? '').trim().length > 0) {
      lastIdx = i
      break
    }
  }

  if (lastIdx === -1) return { cleanedText: text, wordIds: [] }

  const lastLine = (lines[lastIdx] ?? '').trim()
  const match = lastLine.match(/^[ \t>*#-]*СЛОВА\s*[:—]\s*(.+)$/iu)

  if (!match) return { cleanedText: text, wordIds: [] }

  const idByWord = new Map<string, number>()

  for (const w of words) {
    idByWord.set(normalizeToken(w.word), w.id)
  }

  const tokens = (match[1] ?? '').split(',').map((t) => t.trim()).filter((t) => t.length > 0)

  if (tokens.length === 0) return { cleanedText: text, wordIds: [] }

  const ids: number[] = []

  for (const token of tokens) {
    const norm = normalizeToken(token)

    if (norm === 'нет') continue

    if (/^#?\d+$/.test(token)) {
      ids.push(Number(token.replace(/\D/g, '')))
      continue
    }

    const wordId = idByWord.get(norm)

    if (wordId !== undefined) {
      ids.push(wordId)
      continue
    }

    return { cleanedText: text, wordIds: [] }
  }

  const wordIds = Array.from(new Set(ids))
  const cleanedText = lines.slice(0, lastIdx).join('\n').trimEnd()

  return { cleanedText, wordIds }
}
