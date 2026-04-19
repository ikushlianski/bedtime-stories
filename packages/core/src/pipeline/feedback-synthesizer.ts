import { desc } from 'drizzle-orm'
import { db } from '../db/client'
import { feedback, childDiary, childProfiles, stories } from '../db/schema'
import { claudeCliRunner } from '../ai'

const SYNTHESIZER_MODEL = 'claude-sonnet-4-6'

export async function synthesizeSashaContext(): Promise<string | null> {
  const [recentFeedback, recentDiary, recentStories, [profile]] = await Promise.all([
    db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(5),
    db.select().from(childDiary).orderBy(desc(childDiary.createdAt)).limit(10),
    db.select({ title: stories.title }).from(stories).orderBy(desc(stories.createdAt)).limit(5),
    db.select().from(childProfiles).limit(1),
  ])

  const hasFeedback = recentFeedback.length > 0
  const hasDiary = recentDiary.length > 0
  const hasProfile = !!profile && (
    profile.name || profile.activities || profile.interests || profile.dislikes || profile.favourites || profile.notes
  )

  if (!hasFeedback && !hasDiary && !hasProfile) {
    return null
  }

  const profileSection = hasProfile
    ? [
      'ПРОФИЛЬ РЕБЁНКА:',
      ...(profile.name ? [`Имя: ${profile.name}${profile.age ? `, ${profile.age} лет` : ''}`] : []),
      ...(profile.activities ? [`Кружки и занятия: ${profile.activities}`] : []),
      ...(profile.interests ? [`Чем увлекается: ${profile.interests}`] : []),
      ...(profile.dislikes ? [`Что не любит: ${profile.dislikes}`] : []),
      ...(profile.favourites ? [`Любимые персонажи и истории: ${profile.favourites}`] : []),
      ...(profile.notes ? [`Дополнительно: ${profile.notes}`] : []),
    ].join('\n')
    : null

  const feedbackSection = hasFeedback
    ? recentFeedback.map((f, i) => {
      const sf = f.structuredFeedback

      const lines = [`Отзыв ${i + 1} (оценка: ${f.rating ?? 'нет'})`]

      if (f.comment) {
        lines.push(`  Комментарий: ${f.comment}`)
      }

      if (sf) {
        lines.push(`  Понравилось: ${sf.enjoyed}/5`)
        lines.push(`  Было смешно: ${sf.was_funny ? 'да' : 'нет'}`)
        lines.push(`  Было страшно: ${sf.was_scary ? 'да' : 'нет'}`)
        lines.push(`  Слишком длинно: ${sf.too_long ? 'да' : 'нет'}`)
        lines.push(`  Любимый момент: ${sf.favorite_moment}`)
        lines.push(`  Любимый персонаж: ${sf.favorite_character}`)
        lines.push(`  Понял мораль: ${sf.understood_moral ? 'да' : 'нет'}`)
        lines.push(`  Хочет снова: ${sf.want_again ? 'да' : 'нет'}`)

        if (sf.notes) {
          lines.push(`  Заметки: ${sf.notes}`)
        }
      }

      return lines.join('\n')
    }).join('\n\n')
    : 'Отзывов пока нет.'

  const diarySection = hasDiary
    ? recentDiary.map((d, i) => `Запись ${i + 1}: ${d.content}`).join('\n')
    : 'Дневниковых записей пока нет.'

  const recentTitles = recentStories
    .filter((s) => s.title)
    .map((s) => `- ${s.title}`)
    .join('\n')

  const titlesSection = recentTitles.length > 0
    ? `Последние темы историй (избегать повторения):\n${recentTitles}`
    : 'Историй пока не было.'

  const promptParts = [
    'Ты — помощник, который анализирует данные о ребёнке и синтезирует контекст для создания персонализированных сказок.',
    '',
    'На основе данных ниже составь короткий контекст (~200 слов) на русском языке в следующем формате:',
    '',
    'ПРИНЦИПЫ (что работает):',
    '- ...',
    '',
    'ТЕКУЩАЯ ЖИЗНЬ РЕБЁНКА (из дневника, для вдохновения — не копировать буквально):',
    '- ...',
    '',
    'ИЗБЕГАТЬ (что не зашло или уже было недавно):',
    '- ...',
    '',
    'Важно: не предлагай копировать конкретные моменты из дневника. Извлекай принципы и паттерны. Дневниковые записи — источник вдохновения, а не сценарий.',
    '',
    '---',
    '',
  ]

  if (profileSection) {
    promptParts.push(profileSection, '', '---', '')
  }

  promptParts.push(
    'ДАННЫЕ ОБ ОТЗЫВАХ:',
    feedbackSection,
    '',
    'ДНЕВНИКОВЫЕ ЗАПИСИ:',
    diarySection,
    '',
    titlesSection,
  )

  const prompt = promptParts.join('\n')

  return claudeCliRunner.runText({
    model: SYNTHESIZER_MODEL,
    prompt,
    label: 'feedback-synthesizer',
  })
}
