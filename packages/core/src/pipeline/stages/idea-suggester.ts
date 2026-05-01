import { aiRunner } from '../../ai'
import { IdeaSuggesterOutputSchema, type IdeaSuggesterOutput } from '../schemas'
import { resolveStageModel } from '../derivers/resolve-stage-model'

export async function runIdeaSuggester(options: {
  universeContext: string
  universeStyleGuide?: string | undefined
  previousStories: Array<{ title: string; seed: string; planFinal?: string }>
  approvedIdeasSummary?: string | undefined
  rejectedIdeasSummary?: string | undefined
  universeId?: number | null
  model: string
  cwd?: string
}): Promise<IdeaSuggesterOutput> {
  const {
    universeContext,
    universeStyleGuide,
    previousStories,
    approvedIdeasSummary,
    rejectedIdeasSummary,
    model,
  } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  if (!model) {
    throw new Error('Model is required for idea suggestion')
  }

  let storiesSummary = ''
  if (previousStories.length > 0) {
    storiesSummary = `\n\nПРЕДЫДУЩИЕ ИСТОРИИ В ЭТОЙ ВСЕЛЕННОЙ:\n${previousStories
      .map((s) => `- "${s.title || '(без названия)'}" (семя: ${s.seed})`)
      .join('\n')}`
  }

  let styleGuideBlock = ''
  if (universeStyleGuide) {
    styleGuideBlock = `\n\nРУКОВОДСТВО ПО СТИЛЮ:\n${universeStyleGuide}`
  }

  let approvedBlock = ''
  if (approvedIdeasSummary) {
    approvedBlock = `\n\nУЖЕ ОДОБРЕННЫЕ ИДЕИ (ИЗБЕГАТЬ ДУБЛИРОВАНИЯ):\n${approvedIdeasSummary}`
  }

  let rejectedBlock = ''
  if (rejectedIdeasSummary) {
    rejectedBlock = `\n\nОТКЛОНЕННЫЕ ИДЕИ (ИЗБЕГАТЬ):\n${rejectedIdeasSummary}`
  }

  const prompt = `Ты помощник по генерированию идей для сказок в определённой вселенной.

КОНТЕКСТ ВСЕЛЕННОЙ:
${universeContext}${styleGuideBlock}${storiesSummary}${approvedBlock}${rejectedBlock}

Генерируй 5-7 новых идей для сказок в этой вселенной. Идеи должны быть:
- Уникальными и отличаться от предыдущих историй
- Подходящими к стилю вселенной
- Интересными для детей перед сном
- Сгруппированными по темам (например: "приключения", "дружба", "семья", "волшебство" и т.д.)

Для каждой идеи укажи:
- seed: одна-две строки, описывающие основную идею сказки
- rationale: объяснение, почему эта идея подходит для этой вселенной`

  return aiRunner.runStructured({
    skill: 'idea-suggester',
    model,
    prompt,
    outputSchema: IdeaSuggesterOutputSchema,
    stage: 'ideaSuggester',
    ...cwdArg,
  })
}
