import { aiRunner } from '../../ai'
import { TopicCombinerOutputSchema, type TopicCombinerOutput } from '../schemas'

export interface TopicPoolItem {
  id: number
  title: string
  note?: string | null
  usedCount: number
}

export async function runTopicCombiner(options: {
  topics: TopicPoolItem[]
  universeContext?: string | undefined
  universeStyleGuide?: string | undefined
  model: string
  cwd?: string
}): Promise<TopicCombinerOutput> {
  const { topics, universeContext, universeStyleGuide, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  if (!model) {
    throw new Error('Model is required for topic combining')
  }

  const topicList = topics
    .map((t) => {
      const note = t.note?.trim() ? ` — ${t.note.trim()}` : ''
      const used = t.usedCount > 0 ? ` (использована в ${t.usedCount} историях)` : ''
      return `[#${t.id}] ${t.title}${note}${used}`
    })
    .join('\n')

  const contextBlock = universeContext ? `\n\nКОНТЕКСТ ВСЕЛЕННОЙ:\n${universeContext}` : ''
  const styleBlock = universeStyleGuide ? `\n\nРУКОВОДСТВО ПО СТИЛЮ:\n${universeStyleGuide}` : ''

  const prompt = `Родитель собирает «темы» — то, что он хотел бы объяснить или показать своему сыну через сказки, но пока без конкретного сюжета. Твоя задача — предложить несколько удачных комбинаций из 2–3 тем, которые естественно сплетаются в ОДНУ цельную историю.

ПУЛ ТЕМ (каждая с её id):
${topicList}${contextBlock}${styleBlock}

Предложи 3–5 комбинаций. Для каждой:
- topicIds: массив из 2–3 id тем ИЗ СПИСКА ВЫШЕ (только реально существующие id)
- title: короткое рабочее название будущей истории
- seed: 1–2 предложения — как эти темы соединяются в один сюжет (это станет затравкой для истории)
- rationale: почему именно эти темы хорошо работают вместе

Правила:
- Никогда не бери больше 3 тем в одну комбинацию.
- Комбинируй темы, которые усиливают друг друга, а не случайный набор.
- Разнообразь комбинации между собой; можно предлагать разные пары из одного пула.
- Повторное использование уже использованных тем допустимо — это не ограничение, просто держи баланс свежести.`

  return aiRunner.runStructured({
    skill: 'topic-combiner',
    model,
    prompt,
    outputSchema: TopicCombinerOutputSchema,
    stage: 'topicCombiner',
    ...cwdArg,
  })
}
