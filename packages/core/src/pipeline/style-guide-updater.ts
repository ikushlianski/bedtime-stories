import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { storyGroups } from '../db/schema'
import { claudeCliRunner } from '../ai'
import type { StoryAnalysisOutput } from './schemas'
import { compileStyleGuide } from './derivers/style-guide'

const MODEL = 'claude-sonnet-4-6'

const StyleGuideSectionsSchema = z.object({
  works: z.string(),
  doesntWork: z.string(),
  techniques: z.string(),
  minimize: z.string(),
})

export async function updateStyleGuide(
  groupId: number,
  newAnalysis: StoryAnalysisOutput,
  storyTitle: string,
): Promise<void> {
  const [group] = await db.select().from(storyGroups).where(eq(storyGroups.id, groupId))

  if (!group) return

  const existingWorks = group.styleGuideWorks ?? ''
  const existingDoesntWork = group.styleGuideDoesntWork ?? ''
  const existingTechniques = group.styleGuideTechniques ?? ''
  const existingMinimize = group.styleGuideMinimize ?? ''

  const workedBullets = newAnalysis.style_patterns.what_worked.map((w) => `- ${w}`).join('\n')
  const didntWorkBullets = newAnalysis.style_patterns.what_didnt_work.map((w) => `- ${w}`).join('\n')

  const prompt = [
    'Ты ведёшь накопительный гайд по стилю для серии детских сказок.',
    'Объедини существующие данные каждой секции с новыми находками из проанализированной истории.',
    '',
    'Верни ТОЛЬКО валидный JSON без каких-либо пояснений:',
    '{',
    '  "works": "(пункты, что работает — конкретно, не абстрактно; максимум 10 строк с дефисом)",',
    '  "doesntWork": "(пункты, чего избегать; максимум 6 строк)",',
    '  "techniques": "(предпочтительные структурные техники: длина, ритм, диалог; свободный текст)",',
    '  "minimize": "(что сократить или убрать; максимум 5 строк)"',
    '}',
    '',
    'Правила:',
    '- Пиши на русском языке',
    '- Дистиллируй — не копируй, объединяй похожие наблюдения',
    '- Если данных мало или нет — верни пустую строку для этой секции',
    '',
    `СУЩЕСТВУЮЩИЙ ГАЙД:`,
    `works: ${existingWorks || '(пусто)'}`,
    `doesntWork: ${existingDoesntWork || '(пусто)'}`,
    `techniques: ${existingTechniques || '(пусто)'}`,
    `minimize: ${existingMinimize || '(пусто)'}`,
    '',
    `НОВЫЕ НАХОДКИ ИЗ ИСТОРИИ «${storyTitle}»:`,
    `Что работало:\n${workedBullets || '(нет данных)'}`,
    `Что не работало:\n${didntWorkBullets || '(нет данных)'}`,
    `Структурные наблюдения: ${newAnalysis.style_patterns.structural_notes}`,
    `Резюме: ${newAnalysis.analysis_summary}`,
  ].join('\n')

  const raw = await claudeCliRunner.runText({
    model: MODEL,
    prompt,
    label: 'style-guide-updater',
  })

  const jsonMatch = raw.match(/\{[\s\S]*\}/)

  if (!jsonMatch) return

  const parsed = StyleGuideSectionsSchema.safeParse(JSON.parse(jsonMatch[0]))

  if (!parsed.success) return

  const { works, doesntWork, techniques, minimize } = parsed.data

  const compiled = compileStyleGuide({ works, doesntWork, techniques, minimize })

  await db
    .update(storyGroups)
    .set({
      styleGuideWorks: works || null,
      styleGuideDoesntWork: doesntWork || null,
      styleGuideTechniques: techniques || null,
      styleGuideMinimize: minimize || null,
      styleGuide: compiled || null,
    })
    .where(eq(storyGroups.id, groupId))
}
