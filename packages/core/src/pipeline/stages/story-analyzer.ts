import { aiRunner } from '../../ai'
import { StoryAnalysisOutputSchema, type StoryAnalysisOutput } from '../schemas'
import { resolveStageModel } from '../derivers/resolve-stage-model'

export async function runStoryAnalyzer(options: {
  storyText: string
  universeContext?: string
  universeId?: number | null
  model?: string
  cwd?: string
}): Promise<StoryAnalysisOutput> {
  const { storyText } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const universeContextBlock = options.universeContext
    ? `\n\n---\nКОНТЕКСТ ВСЕЛЕННОЙ (для справки при анализе):\n${options.universeContext}\n---\n`
    : ''

  const prompt = `ТЕКСТ СКАЗКИ ДЛЯ АНАЛИЗА:${universeContextBlock}\n\n${storyText}`
  const choice = await resolveStageModel(options.universeId ?? null, 'storyAnalyzer')
  const model = options.model ?? choice.model

  return aiRunner.runStructured({
    skill: 'story-analyzer',
    model,
    fallback: choice.fallback,
    prompt,
    outputSchema: StoryAnalysisOutputSchema,
    stage: 'storyAnalyzer',
    ...cwdArg,
  })
}
