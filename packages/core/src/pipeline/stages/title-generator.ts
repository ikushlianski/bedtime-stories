import { aiRunner } from '../../ai'

export async function generateStoryTitle(options: {
  plan: string
  seed: string
  model: string
  cwd?: string
}): Promise<string> {
  const { plan, seed, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

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

  const raw = await aiRunner.runText({ model, prompt, label: 'title-generator', ...cwdArg })

  return raw.trim().replace(/^["«»""]|["«»""]$/g, '').trim()
}
