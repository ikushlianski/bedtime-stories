import { aiRunner } from '../../ai'
import { UniverseFactExtractorOutputSchema, type UniverseFactExtractorOutput } from '../schemas'
import { resolveStageModel } from '../derivers/resolve-stage-model'

export async function runUniverseFactExtractor(options: {
  storyText: string
  existingCharacters: Array<{ name: string; description: string }>
  universeId?: number | null
  model?: string
  cwd?: string
}): Promise<UniverseFactExtractorOutput> {
  const { storyText, existingCharacters } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const charactersBlock = existingCharacters.length > 0
    ? `\n\nСУЩЕСТВУЮЩИЕ ПЕРСОНАЖИ ВСЕЛЕННОЙ:\n${existingCharacters.map((c) => `- ${c.name}: ${c.description || '(нет описания)'}`).join('\n')}`
    : ''

  const prompt = `ТЕКСТ ИСТОРИИ:${charactersBlock}\n\n${storyText}`

  const choice = await resolveStageModel(options.universeId ?? null, 'universeFactExtractor')
  const model = options.model ?? choice.model

  return aiRunner.runStructured({
    skill: 'universe-fact-extractor',
    model,
    fallback: choice.fallback,
    prompt,
    outputSchema: UniverseFactExtractorOutputSchema,
    stage: 'universeFactExtractor',
    ...cwdArg,
  })
}
