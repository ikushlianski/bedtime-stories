import { aiRunner } from '../../ai'
import { IllustrationMomentsOutputSchema, type IllustrationMomentsOutput } from '../schemas'

const MODEL = 'deepseek/deepseek-v4-flash'
const FALLBACK = 'deepseek/deepseek-v4-pro'

export async function selectIllustrationMoments(options: {
  storyText: string
  characterNames?: string[]
  model?: string
  cwd?: string
}): Promise<IllustrationMomentsOutput> {
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const model = options.model ?? MODEL

  const characterNamesBlock =
    options.characterNames && options.characterNames.length > 0
      ? `\n\nКАНОНИЧЕСКИЕ ИМЕНА ПЕРСОНАЖЕЙ ЭТОЙ ВСЕЛЕННОЙ (используй ровно эти формы в characters_present, если персонаж из этого списка встречается в сцене, даже если в тексте его имя склоняется иначе):\n${options.characterNames.join(', ')}`
      : ''

  const prompt = `ТЕКСТ СКАЗКИ ДЛЯ ВЫБОРА СЦЕН ИЛЛЮСТРАЦИЙ:\n\n${options.storyText}${characterNamesBlock}`

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
