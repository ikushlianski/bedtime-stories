export interface TopicSeedInput {
  title: string
  note?: string | null
}

export interface TopicCombo {
  topicIds: number[]
  title: string
  seed: string
  rationale: string
}

export function synthesizeSeedFromTopics(topics: TopicSeedInput[]): string {
  const lines = topics
    .map((t) => {
      const title = t.title.trim()
      const note = t.note?.trim()
      return note ? `«${title}» — ${note}` : `«${title}»`
    })
    .filter((line) => line.length > 0)

  const themeList = lines.join('; ')

  return [
    'Построй одну цельную историю, которая естественно затрагивает несколько тем, которые родитель хочет донести до ребёнка:',
    themeList,
    'Сплети эти темы в единый сюжет так, чтобы они раскрывались через события, а не перечислялись в лоб. Не обязательно уделять каждой теме поровну — важно, чтобы история осталась цельной и живой.',
  ].join('\n')
}

export function filterValidCombos(combos: TopicCombo[], eligibleTopicIds: Iterable<number>): TopicCombo[] {
  const eligible = new Set(eligibleTopicIds)

  return combos.filter((combo) => {
    const unique = Array.from(new Set(combo.topicIds))

    if (unique.length < 2 || unique.length > 3) return false

    return unique.every((id) => eligible.has(id))
  })
}

export function isValidComboSelection(topicIds: number[], eligibleTopicIds: Iterable<number>): boolean {
  const eligible = new Set(eligibleTopicIds)
  const unique = Array.from(new Set(topicIds))

  if (unique.length < 2 || unique.length > 3) return false

  return unique.every((id) => eligible.has(id))
}
