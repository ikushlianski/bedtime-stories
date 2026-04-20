import { claudeCliRunner } from '../../ai'
import { StoryAnalysisOutputSchema, type StoryAnalysisOutput } from '../schemas'

const MODEL = 'claude-sonnet-4-6'

export async function runStoryAnalyzer(options: {
  storyText: string
  universeContext?: string
  model?: string
  cwd?: string
}): Promise<StoryAnalysisOutput> {
  const { storyText } = options
  const model = options.model ?? MODEL
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const universeContextBlock = options.universeContext
    ? `\n\n---\nКОНТЕКСТ ВСЕЛЕННОЙ (для справки при анализе):\n${options.universeContext}\n---\n`
    : ''

  const prompt = `ТЕКСТ СКАЗКИ ДЛЯ АНАЛИЗА:${universeContextBlock}\n\n${storyText}`

  return claudeCliRunner.runStructured({
    skill: 'story-analyzer',
    model,
    prompt,
    outputSchema: StoryAnalysisOutputSchema,
    ...cwdArg,
  })
}
