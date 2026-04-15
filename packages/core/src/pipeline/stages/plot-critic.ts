import { claudeCliRunner } from '../../ai'
import { CriticOutputSchema, type CriticOutput, type PsychologistOutput } from '../schemas'

export async function runPlotCritic(options: {
  plan: string
  psychologistOutput: PsychologistOutput
  iterationNumber: number
  model: string
  universeSystemPrompt?: string
  cwd?: string
}): Promise<CriticOutput> {
  const { plan, psychologistOutput, iterationNumber, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const basePrompt = [
    `Current story plan:\n${plan}`,
    `Psychologist assessment:\n${JSON.stringify(psychologistOutput, null, 2)}`,
    `Iteration number: ${iterationNumber}`,
  ].join('\n\n')

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
