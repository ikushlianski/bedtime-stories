import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { storyGroups } from '../db/schema'
import { claudeCliRunner } from '../ai'
import type { StoryAnalysisOutput } from './schemas'

const MODEL = 'claude-sonnet-4-6'

export async function updateStyleGuide(
  groupId: number,
  newAnalysis: StoryAnalysisOutput,
  storyTitle: string,
): Promise<void> {
  const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, groupId))

  if (!group) return

  const existing = group.styleGuide ?? ''

  const workedBullets = newAnalysis.style_patterns.what_worked.map((w) => `- ${w}`).join('\n')
  const didntWorkBullets = newAnalysis.style_patterns.what_didnt_work.map((w) => `- ${w}`).join('\n')

  const prompt = [
    'Ты ведёшь накопительный гайд по стилю для серии детских сказок.',
    'Объедини существующий гайд с находками из новой проанализированной истории.',
    'Результат должен быть в следующем формате (строго, без лишних секций):',
    '',
    '## Что работает',
    '- (паттерны, которые работают — конкретные наблюдения, не абстракции; максимум 10 пунктов)',
    '',
    '## Что не работает',
    '- (паттерны, которые не работают или которых следует избегать; максимум 6 пунктов)',
    '',
    '## Структурные паттерны',
    '(свободный текст: длина, ритм, соотношение диалога и нарратива, тип концовок)',
    '',
    '## Источники',
    '- Название истории — краткая заметка о ней (максимум 8 источников, удаляй старые)',
    '',
    'Правила:',
    '- Пиши на русском языке',
    '- Дистиллируй — не копируй, объединяй похожие наблюдения',
    '- Убирай устаревшее, если добавляется более актуальное',
    '- Возвращай только отформатированные секции, без комментариев',
    '',
    existing.length > 0 ? `СУЩЕСТВУЮЩИЙ ГАЙД:\n${existing}` : 'СУЩЕСТВУЮЩИЙ ГАЙД: (пока пусто)',
    '',
    `НОВЫЕ НАХОДКИ ИЗ ИСТОРИИ «${storyTitle}»:`,
    `Что работало:\n${workedBullets || '(нет данных)'}`,
    `\nЧто не работало:\n${didntWorkBullets || '(нет данных)'}`,
    `\nСтруктурные наблюдения: ${newAnalysis.style_patterns.structural_notes}`,
    `\nРезюме: ${newAnalysis.analysis_summary}`,
  ].join('\n')

  const updated = await claudeCliRunner.runText({
    model: MODEL,
    prompt,
    label: 'style-guide-updater',
  })

  await db
    .update(storyGroups)
    .set({ styleGuide: updated.trim() })
    .where(eq(storyGroups.id, groupId))
}
