import { claudeCliRunner } from '../../ai'
import { UniverseFactExtractorOutputSchema, type UniverseFactExtractorOutput } from '../schemas'

const MODEL = 'claude-sonnet-4-6'

export async function runUniverseFactExtractor(options: {
  storyText: string
  existingCharacters: Array<{ name: string; description: string }>
  model?: string
  cwd?: string
}): Promise<UniverseFactExtractorOutput> {
  const { storyText, existingCharacters } = options
  const model = options.model ?? MODEL
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const charactersBlock = existingCharacters.length > 0
    ? `\n\nСУЩЕСТВУЮЩИЕ ПЕРСОНАЖИ ВСЕЛЕННОЙ:\n${existingCharacters.map((c) => `- ${c.name}: ${c.description || '(нет описания)'}`).join('\n')}`
    : ''

  const prompt = `ТЕКСТ ИСТОРИИ:${charactersBlock}\n\n${storyText}`

  return claudeCliRunner.runStructured({
    skill: 'universe-fact-extractor',
    model,
    prompt,
    outputSchema: UniverseFactExtractorOutputSchema,
    ...cwdArg,
  })
}
