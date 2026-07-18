export const SIGNAL_WEIGHTS = {
  childProfile: 1.0,
  parentNoteOnStory: 1.0,
  parentNoteOnPlan: 0.95,
  sashaLaughed: 0.9,
  sashaLoved: 0.85,
  sashaDisliked: 0.85,
  structuredFeedback: 0.8,
  sashaReaction: 0.7,
  childDiary: 0.6,
  storyAnalysis: 0.5,
  recentTitles: 0.4,
} as const

export interface AnnotationSignal {
  selectedText: string | null
  noteText: string | null
  storyTitle: string
}

export interface StructuredFeedbackSignal {
  rating: number | null
  comment: string | null
  enjoyed: number | null
  was_funny: boolean | null
  too_long: boolean | null
  favorite_moment: string | null
  favorite_character: string | null
  want_again: boolean | null
  notes: string | null
}

export interface ChildProfileSignal {
  name: string | null
  age: number | null
  activities: string | null
  interests: string | null
  dislikes: string | null
  favourites: string | null
  notes: string | null
}

export interface SynthesizerInput {
  profile: ChildProfileSignal | null
  parentNotesOnText: AnnotationSignal[]
  parentNotesOnPlan: AnnotationSignal[]
  sashaLaughed: AnnotationSignal[]
  sashaLoved: AnnotationSignal[]
  sashaDisliked: AnnotationSignal[]
  structuredFeedback: StructuredFeedbackSignal[]
  sashaReactions: AnnotationSignal[]
  diaryEntries: string[]
  storyAnalyses: string[]
  recentTitles: string[]
}

function formatAnnotation(a: AnnotationSignal): string {
  const note = a.noteText ? ` → ${a.noteText}` : ''
  const subject = a.selectedText ? `«${a.selectedText}»` : 'общий комментарий'
  return `  ${subject}${note} [из «${a.storyTitle}»]`
}

export function buildSynthesizerPrompt(input: SynthesizerInput): string {
  const parts: string[] = [
    'Ты — помощник, который анализирует данные о ребёнке и синтезирует контекст для создания новых сказок.',
    '',
    'На основе данных ниже составь структурированный контекст (~300 слов) на русском языке:',
    '',
    'ПРИНЦИПЫ ЧТО РАБОТАЕТ (из заметок и реакций):',
    '- ...',
    '',
    'ЧТО ТОЧНО СМЕШИТ САШУ (конкретные типы юмора и ситуаций):',
    '- ...',
    '',
    'ЧТО САШЕ НРАВИТСЯ (типы историй, персонажей, моментов):',
    '- ...',
    '',
    'ЧЕГО ИЗБЕГАТЬ (что не зашло, что уже было):',
    '- ...',
    '',
    'ТЕКУЩАЯ ЖИЗНЬ РЕБЁНКА (из дневника — для вдохновения, не копировать буквально):',
    '- ...',
    '',
    'Важно: данные ниже отсортированы по приоритету. Секции с пометкой КРИТИЧЕСКИ ВАЖНО должны доминировать в выводах.',
    '',
    '===',
    '',
  ]

  if (input.profile) {
    const p = input.profile
    const hasContent = p.name || p.activities || p.interests || p.dislikes || p.favourites || p.notes

    if (hasContent) {
      parts.push(`[ВЕС ${SIGNAL_WEIGHTS.childProfile}] ПРОФИЛЬ РЕБЁНКА (КРИТИЧЕСКИ ВАЖНО):`)

      if (p.name) parts.push(`Имя: ${p.name}${p.age ? `, ${p.age} лет` : ''}`)
      if (p.activities) parts.push(`Кружки и занятия: ${p.activities}`)
      if (p.interests) parts.push(`Чем увлекается: ${p.interests}`)
      if (p.dislikes) parts.push(`Что не любит: ${p.dislikes}`)
      if (p.favourites) parts.push(`Любимые персонажи и истории: ${p.favourites}`)
      if (p.notes) parts.push(`Дополнительно: ${p.notes}`)
      parts.push('')
    }
  }

  if (input.parentNotesOnText.length > 0) {
    parts.push(
      `[ВЕС ${SIGNAL_WEIGHTS.parentNoteOnStory}] ЗАМЕТКИ РОДИТЕЛЯ НА ГОТОВЫХ ИСТОРИЯХ (КРИТИЧЕСКИ ВАЖНО):`,
      'Это прямые наблюдения и комментарии к тексту. Учитывать в первую очередь.',
      ...input.parentNotesOnText.map(formatAnnotation),
      '',
    )
  }

  if (input.parentNotesOnPlan.length > 0) {
    parts.push(
      `[ВЕС ${SIGNAL_WEIGHTS.parentNoteOnPlan}] ЗАМЕТКИ РОДИТЕЛЯ К ПЛАНАМ ИСТОРИЙ (КРИТИЧЕСКИ ВАЖНО):`,
      'Что родитель хотел изменить или улучшить в сюжетах.',
      ...input.parentNotesOnPlan.map(formatAnnotation),
      '',
    )
  }

  if (input.sashaLaughed.length > 0) {
    parts.push(
      `[ВЕС ${SIGNAL_WEIGHTS.sashaLaughed}] МОМЕНТЫ, ГДЕ САША СМЕЯЛСЯ (ОЧЕНЬ ВАЖНО):`,
      'Конкретные отрывки и ситуации — ключ к пониманию юмора, который работает.',
      ...input.sashaLaughed.map(formatAnnotation),
      '',
    )
  }

  if (input.sashaLoved.length > 0) {
    parts.push(
      `[ВЕС ${SIGNAL_WEIGHTS.sashaLoved}] ЧТО САШЕ ОСОБЕННО ПОНРАВИЛОСЬ (ОЧЕНЬ ВАЖНО):`,
      ...input.sashaLoved.map(formatAnnotation),
      '',
    )
  }

  if (input.sashaDisliked.length > 0) {
    parts.push(
      `[ВЕС ${SIGNAL_WEIGHTS.sashaDisliked}] ЧТО САШЕ НЕ ПОНРАВИЛОСЬ (ОЧЕНЬ ВАЖНО — ИЗБЕГАТЬ):`,
      ...input.sashaDisliked.map(formatAnnotation),
      '',
    )
  }

  if (input.structuredFeedback.length > 0) {
    parts.push(`[ВЕС ${SIGNAL_WEIGHTS.structuredFeedback}] ОТЗЫВЫ НА ИСТОРИИ (ВАЖНО):`)

    for (const [i, f] of input.structuredFeedback.entries()) {
      const lines = [`Отзыв ${i + 1} (оценка: ${f.rating ?? 'нет'})`]

      if (f.comment) lines.push(`  Комментарий: ${f.comment}`)
      if (f.enjoyed !== null) lines.push(`  Понравилось: ${f.enjoyed}/5`)
      if (f.was_funny !== null) lines.push(`  Было смешно: ${f.was_funny ? 'да' : 'нет'}`)
      if (f.too_long !== null) lines.push(`  Слишком длинно: ${f.too_long ? 'да' : 'нет'}`)
      if (f.favorite_moment) lines.push(`  Любимый момент: ${f.favorite_moment}`)
      if (f.favorite_character) lines.push(`  Любимый персонаж: ${f.favorite_character}`)
      if (f.want_again !== null) lines.push(`  Хочет снова: ${f.want_again ? 'да' : 'нет'}`)
      if (f.notes) lines.push(`  Заметки: ${f.notes}`)

      parts.push(lines.join('\n'))
    }

    parts.push('')
  }

  if (input.sashaReactions.length > 0) {
    parts.push(
      `[ВЕС ${SIGNAL_WEIGHTS.sashaReaction}] РЕАКЦИИ САШИ (ВАЖНО):`,
      ...input.sashaReactions.map(formatAnnotation),
      '',
    )
  }

  if (input.diaryEntries.length > 0) {
    parts.push(
      `[ВЕС ${SIGNAL_WEIGHTS.childDiary}] ДНЕВНИКОВЫЕ ЗАПИСИ (ПОЛЕЗНО — для вдохновения):`,
      ...input.diaryEntries.map((d, i) => `Запись ${i + 1}: ${d}`),
      '',
    )
  }

  if (input.storyAnalyses.length > 0) {
    parts.push(
      `[ВЕС ${SIGNAL_WEIGHTS.storyAnalysis}] АНАЛИЗ ПРИМЕРНЫХ ИСТОРИЙ (ПОЛЕЗНО):`,
      ...input.storyAnalyses,
      '',
    )
  }

  if (input.recentTitles.length > 0) {
    parts.push(
      `[ВЕС ${SIGNAL_WEIGHTS.recentTitles}] ПОСЛЕДНИЕ ИСТОРИИ (избегать повторения тем):`,
      ...input.recentTitles.map((t) => `- ${t}`),
      '',
    )
  }

  return parts.join('\n')
}
