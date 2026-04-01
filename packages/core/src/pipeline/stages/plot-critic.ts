import { runAgent } from '../agent-runner'
import { CriticOutputSchema, type CriticOutput, type PsychologistOutput } from '../schemas'

export async function runPlotCritic(options: {
  plan: string
  psychologistOutput: PsychologistOutput
  iterationNumber: number
  model: string
  cwd?: string
}): Promise<CriticOutput> {
  const { plan, psychologistOutput, iterationNumber, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const prompt = [
    `Current story plan:\n${plan}`,
    `Psychologist assessment:\n${JSON.stringify(psychologistOutput, null, 2)}`,
    `Iteration number: ${iterationNumber}`,
  ].join('\n\n')

  return runAgent({
    skillName: 'plot-critic',
    model,
    prompt,
    outputSchema: CriticOutputSchema,
    ...cwdArg,
  })
}
