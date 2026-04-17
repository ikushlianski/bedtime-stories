import { claudeCliRunner } from '../../ai'
import { CriticOutputSchema, type CriticOutput, type PsychologistOutput } from '../schemas'

export async function runPlotCritic(options: {
  plan: string
  psychologistOutput: PsychologistOutput
  iterationNumber: number
  model: string
  universeSystemPrompt?: string
  universeContext?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<CriticOutput> {
  const { plan, psychologistOutput, iterationNumber, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const universeContextBlock = options.universeContext
    ? `\n\n---\nКОНТЕКСТ ВСЕЛЕННОЙ:\n${options.universeContext}\n---\n`
    : ''

  const basePrompt = [
    `Current story plan:\n${plan}`,
    `Psychologist assessment:\n${JSON.stringify(psychologistOutput, null, 2)}`,
    `Iteration number: ${iterationNumber}`,
  ].join('\n\n') + universeContextBlock + sashaContextBlock

  const prompt = options.universeSystemPrompt
    ? `${options.universeSystemPrompt}\n\n---\n\n${basePrompt}`
    : basePrompt

  return claudeCliRunner.runStructured({
    skill: 'plot-critic',
    model,
    prompt,
    outputSchema: CriticOutputSchema,
    ...cwdArg,
  })
}
