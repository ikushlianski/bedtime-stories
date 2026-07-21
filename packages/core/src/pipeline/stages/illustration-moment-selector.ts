import { aiRunner } from '../../ai'
import { IllustrationMomentsOutputSchema, type IllustrationMomentsOutput } from '../schemas'

const MODEL = 'deepseek/deepseek-v4-flash'
const FALLBACK = 'deepseek/deepseek-v4-pro'

export async function selectIllustrationMoments(options: {
  storyText: string
  model?: string
  cwd?: string
}): Promise<IllustrationMomentsOutput> {
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const model = options.model ?? MODEL

  const prompt = `ТЕКСТ СКАЗКИ ДЛЯ ВЫБОРА СЦЕН ИЛЛЮСТРАЦИЙ:\n\n${options.storyText}`

  return aiRunner.runStructured({
    skill: 'illustration-moment-selector',
    model,
    fallback: FALLBACK,
    prompt,
    outputSchema: IllustrationMomentsOutputSchema,
    stage: 'illustrationMomentSelector',
    ...cwdArg,
  })
}
