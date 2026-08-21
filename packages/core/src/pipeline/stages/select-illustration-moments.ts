import { aiRunner } from '../../ai'
import { IllustrationMomentSelectorOutputSchema, type IllustrationMomentSelectorOutput } from '../schemas'
import { resolveStageModel } from '../derivers/resolve-stage-model'

export interface SelectIllustrationMomentsOptions {
  storyText: string
  castNames: string[]
  count: number
  alreadyMarkedTexts?: string[]
  universeId?: number | null
  model?: string
  storyId?: number
  cwd?: string
}

function buildPrompt(options: SelectIllustrationMomentsOptions): string {
  const castBlock =
    options.castNames.length > 0
      ? `\n\nИЗВЕСТНЫЕ ПЕРСОНАЖИ ВСЕЛЕННОЙ:\n${options.castNames.join(', ')}`
      : ''

  const alreadyMarked = options.alreadyMarkedTexts ?? []
  const avoidBlock =
    alreadyMarked.length > 0
      ? `\n\nУЖЕ ОТМЕЧЕННЫЕ ОТРЫВКИ (не дублируй эти моменты, выбери другие):\n${alreadyMarked
          .map((text, i) => `${i + 1}. ${text}`)
          .join('\n')}`
      : ''

  return `КОЛИЧЕСТВО МОМЕНТОВ ДЛЯ ВЫБОРА (count): ${options.count}${castBlock}${avoidBlock}\n\nТЕКСТ СКАЗКИ:\n\n${options.storyText}`
}

export async function selectIllustrationMoments(
  options: SelectIllustrationMomentsOptions,
): Promise<IllustrationMomentSelectorOutput> {
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const storyIdArg = options.storyId !== undefined ? { storyId: options.storyId } : {}

  const prompt = buildPrompt(options)
  const choice = await resolveStageModel(options.universeId ?? null, 'illustrationMomentSelector')
  const model = options.model ?? choice.model

  const result = await aiRunner.runStructured({
    skill: 'story-illustration-moments',
    model,
    fallback: choice.fallback,
    prompt,
    outputSchema: IllustrationMomentSelectorOutputSchema,
    stage: 'illustrationMomentSelector',
    ...storyIdArg,
    ...cwdArg,
  })

  return { moments: result.moments.slice(0, options.count) }
}
