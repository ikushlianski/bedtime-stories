import { aiRunner } from '../../ai'
import { CriticOutputSchema, type CriticOutput } from '../schemas'

export async function runPlotCritic(options: {
  plan: string
  iterationNumber: number
  model: string
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<CriticOutput> {
  const { plan, iterationNumber, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const universeContextBlock = options.universeContext
    ? `\n\n---\nКОНТЕКСТ ВСЕЛЕННОЙ:\n${options.universeContext}\n---\n`
    : ''

  const styleGuideBlock = options.styleGuide
    ? `\n\n---\nСТИЛЬ ИСТОРИЙ (чему учат примерные истории — учитывай при оценке):\n${options.styleGuide}\n---\n`
    : ''

  const basePrompt = [
    `Current story plan:\n${plan}`,
    `Iteration number: ${iterationNumber}`,
  ].join('\n\n') + universeContextBlock + styleGuideBlock + sashaContextBlock

  const prompt = options.universeSystemPrompt
    ? `${options.universeSystemPrompt}\n\n---\n\n${basePrompt}`
    : basePrompt

  return aiRunner.runStructured({
    skill: 'plot-critic',
    model,
    prompt,
    outputSchema: CriticOutputSchema,
    ...cwdArg,
  })
}
