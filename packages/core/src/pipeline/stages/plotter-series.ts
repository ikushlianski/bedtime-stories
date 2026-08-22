import { aiRunner } from '../../ai'
import { PLOTTER_SYSTEM_PROMPT_DEFAULT } from './plotter'
import { MAX_FRAGMENTS_PER_STORY, type EligibleFragment } from '../load-fragments'
import { buildCharacterBibleBlock, type CharacterBibleEntry } from './character-bible-block'

export interface SeriesPlanItem {
  outline: string
  titleHint: string
  usedFragmentIds: number[]
}

export async function runPlotterSeries(options: {
  seed: string
  model: string
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  eligibleFragments?: EligibleFragment[]
  bibleCharacters?: CharacterBibleEntry[]
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

  const fragments = options.eligibleFragments ?? []

  const hasExactQuotes = fragments.some((f) => f.exactQuote)

  const fragmentsBlock = fragments.length > 0
    ? [
        '\n\n---',
        'ФРАГМЕНТЫ (необязательные вставки от родителя — забавные, тёплые или поучительные детали):',
        fragments.map((f) => `[Фрагмент #${f.id}${f.exactQuote ? ' (ДОСЛОВНАЯ ЦИТАТА)' : ''}${f.usedCount > 0 ? ' (уже использован ранее)' : ''}] ${f.text}`).join('\n'),
        '',
        `Для каждого черновика реши отдельно: какие фрагменты (от нуля до ${MAX_FRAGMENTS_PER_STORY}) ложатся сюда органично. Обычно меньше; ни одного — нормально. Никогда не строй сюжет вокруг фрагмента. «Уже использованный» бери лишь как редкую отсылку.${hasExactQuotes ? ' Фрагмент, помеченный «(ДОСЛОВНАЯ ЦИТАТА)», должен войти в текст СЛОВО В СЛОВО, а не пересказом.' : ''} Для каждого плана верни массив id выбранных фрагментов (пустой массив, если ни одного).`,
        '---\n',
      ].join('\n')
    : ''

  const fragmentField = fragments.length > 0
    ? `, "usedFragmentIds": [<id выбранных фрагментов или пусто>]`
    : ''

  const characterBibleBlock = buildCharacterBibleBlock(options.bibleCharacters ?? [])

  const prompt = [
    `${basePrompt}${characterBibleBlock}${universeContextBlock}${styleGuideBlock}${sashaContextBlock}${fragmentsBlock}`,
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
    `    { "outline": "<полный план на русском со всеми разделами>", "titleHint": "<название 3-5 слов>"${fragmentField} },`,
    `    { "outline": "...", "titleHint": "..."${fragmentField} },`,
    `    { "outline": "...", "titleHint": "..."${fragmentField} }`,
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

    const rawFragmentIds = (item as Record<string, unknown>)['usedFragmentIds']
    const usedFragmentIds = Array.isArray(rawFragmentIds)
      ? Array.from(new Set(rawFragmentIds.filter((v): v is number => typeof v === 'number' && Number.isInteger(v)))).slice(0, MAX_FRAGMENTS_PER_STORY)
      : []

    return {
      outline: ((item as Record<string, unknown>)['outline'] as string).trim(),
      titleHint: ((item as Record<string, unknown>)['titleHint'] as string).trim(),
      usedFragmentIds,
    }
  })
}
