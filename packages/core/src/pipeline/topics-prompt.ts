export interface EligibleTopic {
  id: number
  title: string
  note: string | null
  rank: number
  usedCount: number
}

export const MAX_TOPICS_PER_STORY = 3

export function buildTopicsBlock(items: EligibleTopic[]): string {
  if (items.length === 0) return ''

  const lines = items.map((t) => {
    const noteText = t.note?.trim() ? ` — ${t.note.trim()}` : ''
    const usedTag = t.usedCount > 0 ? ' (уже поднималась раньше)' : ''
    return `[Тема #${t.id}${usedTag}] ${t.title}${noteText}`
  })

  return [
    '\n\n---',
    'ТЕМЫ (банк того, что родитель хочет однажды объяснить или показать сыну через истории):',
    lines.join('\n'),
    '',
    'Правила работы с темами:',
    '- Выбери 2–3 темы из списка выше, которые органично впишутся именно в эту историю. Обычно 2, иногда 3 — это норма, а не исключение.',
    '- Тема должна раскрываться через события и поведение персонажей, а не проговариваться вслух и не превращаться в мораль. Сплети выбранные темы в единый сюжет, не перечисляй их по очереди и не уделяй им искусственно равное время.',
    '- Если из всего списка ни одна честно не подходит именно этой истории — можно взять меньше, вплоть до нуля, но это редкое исключение, а не обычный выбор.',
    '- Не хватайся за одни и те же темы каждый раз: предпочитай те, что ещё не поднимались или поднимались реже других.',
    '- В САМОМ КОНЦЕ ответа, отдельной последней строкой, выведи: «ТЕМЫ: <id выбранных тем через запятую или слово нет>». Эта строка служебная.',
    '---\n',
  ].join('\n')
}

export interface TopicMarkerResult {
  cleanedText: string
  topicIds: number[]
}

export function extractTopicMarkers(text: string): TopicMarkerResult {
  const match = text.match(/^[ \t>*#-]*ТЕМ(?:Ы|А)\s*[:—-]?\s*([^\n]*)$/im)

  if (!match) return { cleanedText: text, topicIds: [] }

  const payload = match[1] ?? ''
  const ids = Array.from(payload.matchAll(/#?\s*(\d+)/g)).map((m) => Number(m[1]))
  const topicIds = Array.from(new Set(ids))
  const cleanedText = text.replace(match[0], '').replace(/\n{3,}$/, '\n').trimEnd()

  return { cleanedText, topicIds }
}
