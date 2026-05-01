import { aiRunner } from '../../ai'

const TITLE_GENERATOR_MODEL = 'deepseek/deepseek-chat'

export async function generateStoryTitle(options: {
  plan: string
  seed: string
  cwd?: string
  storyId?: number
}): Promise<string> {
  const { plan, seed } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const storyIdArg = options.storyId !== undefined ? { storyId: options.storyId } : {}

  const prompt = [
    'You are a creative children\'s book title writer.',
    'Based on the story plan and seed below, generate a single short title for this bedtime fairy tale.',
    '',
    'Rules:',
    '- Write in Russian',
    '- 2–5 words maximum',
    '- Evocative and magical, fitting for a 6-year-old',
    '- Do NOT use the seed text verbatim',
    '- Return only the title, nothing else — no quotes, no punctuation at the end, no explanation',
    '',
    `SEED: ${seed}`,
    '',
    `STORY PLAN:\n${plan}`,
  ].join('\n')

  const raw = await aiRunner.runText({ model: TITLE_GENERATOR_MODEL, prompt, label: 'title-generator', stage: 'titleGenerator', ...cwdArg, ...storyIdArg })

  return raw.trim().replace(/^["«»""]|["«»""]$/g, '').trim()
}
