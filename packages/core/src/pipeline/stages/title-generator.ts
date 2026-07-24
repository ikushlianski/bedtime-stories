import { aiRunner } from '../../ai'

const TITLE_GENERATOR_MODEL = 'deepseek/deepseek-chat'

const FORBIDDEN_WORD_STEMS = [
  { stem: /тайн/i, label: 'Тайна' },
  { stem: /волшеб/i, label: 'Волшебный' },
]

export function titleContainsForbiddenWord(title: string): boolean {
  return FORBIDDEN_WORD_STEMS.some(({ stem }) => stem.test(title))
}

function findForbiddenWordLabel(title: string): string | null {
  return FORBIDDEN_WORD_STEMS.find(({ stem }) => stem.test(title))?.label ?? null
}

function buildPrompt(options: { plan: string; seed: string; recentTitles: string[] }): string {
  const { plan, seed, recentTitles } = options

  const lines = [
    'You are a creative children\'s book title writer.',
    'Based on the story plan and seed below, generate a single short title for this bedtime fairy tale.',
    '',
    'Rules:',
    '- Write in Russian',
    '- 2–5 words maximum',
    '- Evocative and magical, fitting for a 6-year-old',
    '- Do NOT use the seed text verbatim',
    '- STRICTLY FORBIDDEN: the words "Тайна"/"тайна" and "Волшебный"/"волшебная"/"волшебное", or any inflected'
      + ' or derived form of them (e.g. "Тайну", "Тайны", "Волшебство"). Do not just swap in a synonym either —'
      + ' pick a genuinely different angle for the title: an action, a place, an object, a feeling, a question',
    '- Return only the title, nothing else — no quotes, no punctuation at the end, no explanation',
  ]

  if (recentTitles.length > 0) {
    lines.push(
      '',
      'Недавние заголовки в этой вселенной (НЕ повторяй их слова, структуру или паттерн — придумай что-то по-настоящему другое):',
      ...recentTitles.map((title) => `- ${title}`),
    )
  }

  lines.push('', `SEED: ${seed}`, '', `STORY PLAN:\n${plan}`)

  return lines.join('\n')
}

function buildRetryPrompt(options: { plan: string; seed: string; recentTitles: string[]; offendingTitle: string; offendingWord: string }): string {
  const basePrompt = buildPrompt(options)

  return [
    basePrompt,
    '',
    `Your previous answer was "${options.offendingTitle}", which contains the forbidden word "${options.offendingWord}".`,
    'Generate a completely different title that avoids this word (and its inflections) entirely.',
  ].join('\n')
}

export async function generateStoryTitle(options: {
  plan: string
  seed: string
  cwd?: string
  storyId?: number
  recentTitles?: string[]
}): Promise<string> {
  const { plan, seed } = options
  const recentTitles = options.recentTitles ?? []
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const storyIdArg = options.storyId !== undefined ? { storyId: options.storyId } : {}

  const prompt = buildPrompt({ plan, seed, recentTitles })
  const raw = await aiRunner.runText({ model: TITLE_GENERATOR_MODEL, prompt, label: 'title-generator', stage: 'titleGenerator', ...cwdArg, ...storyIdArg })
  const title = raw.trim().replace(/^["«»""]|["«»""]$/g, '').trim()

  const offendingWord = findForbiddenWordLabel(title)

  if (offendingWord === null) {
    return title
  }

  const retryPrompt = buildRetryPrompt({ plan, seed, recentTitles, offendingTitle: title, offendingWord })
  const retryRaw = await aiRunner.runText({ model: TITLE_GENERATOR_MODEL, prompt: retryPrompt, label: 'title-generator-retry', stage: 'titleGenerator', ...cwdArg, ...storyIdArg })

  return retryRaw.trim().replace(/^["«»""]|["«»""]$/g, '').trim()
}
