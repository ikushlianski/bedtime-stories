import { aiRunner } from '../../ai'
import { PLOTTER_SYSTEM_PROMPT_DEFAULT } from './plotter'

export interface SeriesPlanItem {
  outline: string
  titleHint: string
}

export async function runPlotterSeries(options: {
  seed: string
  model: string
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<SeriesPlanItem[]> {
  const { seed, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const basePrompt = options.universeSystemPrompt
    ? `${options.universeSystemPrompt}\n\n---\n\n${PLOTTER_SYSTEM_PROMPT_DEFAULT}`
    : PLOTTER_SYSTEM_PROMPT_DEFAULT

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const universeContextBlock = options.universeContext
    ? `\n\n---\nКОНТЕКСТ ВСЕЛЕННОЙ (персонажи, события, темы этой вселенной):\n${options.universeContext}\n---\n`
    : ''

  const styleGuideBlock = options.styleGuide
    ? `\n\n---\nСТИЛЬ ИСТОРИЙ (чему учат примерные истории — учитывай при работе):\n${options.styleGuide}\n---\n`
    : ''

  const prompt = [
    `${basePrompt}${universeContextBlock}${styleGuideBlock}${sashaContextBlock}`,
    '',
    `SEED (real-life situation to base the stories on):\n${seed}`,
    '',
    `ЗАДАЧА: Придумай ровно 3 РАЗНЫХ черновика сюжета на основе одной затравки.`,
    `Каждый черновик должен:`,
    `- Исследовать другой угол, ситуацию или акцент в рамках той же темы`,
    `- Иметь свой уникальный сюжет — не просто вариации одного и того же`,
    `- Следовать стандартному формату плана (все обязательные разделы)`,
    ``,
    `Верни ТОЛЬКО валидный JSON без markdown, без комментариев:`,
    `{`,
    `  "plans": [`,
    `    { "outline": "<полный план на русском со всеми разделами>", "titleHint": "<название 3-5 слов>" },`,
    `    { "outline": "...", "titleHint": "..." },`,
    `    { "outline": "...", "titleHint": "..." }`,
    `  ]`,
    `}`,
  ].join('\n')

  const raw = await aiRunner.runText({ model, prompt, label: 'plotter-series', ...cwdArg })

  return parsePlotterSeriesResponse(raw)
}

function parsePlotterSeriesResponse(raw: string): SeriesPlanItem[] {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()

  let parsed: unknown

  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Plotter-series returned no parseable JSON')
    }

    parsed = JSON.parse(jsonMatch[0])
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>)['plans'])
  ) {
    throw new Error('Plotter-series response missing "plans" array')
  }

  const plans = (parsed as { plans: unknown[] }).plans

  if (plans.length < 2) {
    throw new Error(`Plotter-series returned only ${plans.length} plan(s); expected at least 2`)
  }

  return plans.map((item, i) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Record<string, unknown>)['outline'] !== 'string' ||
      typeof (item as Record<string, unknown>)['titleHint'] !== 'string'
    ) {
      throw new Error(`Plotter-series plan[${i}] missing outline or titleHint`)
    }

    return {
      outline: ((item as Record<string, unknown>)['outline'] as string).trim(),
      titleHint: ((item as Record<string, unknown>)['titleHint'] as string).trim(),
    }
  })
}
