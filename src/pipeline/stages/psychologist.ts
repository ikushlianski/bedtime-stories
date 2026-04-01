import { runAgent } from '../agent-runner'
import { PsychologistOutputSchema, type PsychologistOutput } from '../schemas'

export async function runPsychologist(options: {
  plan: string
  seed: string
  iterationNumber: number
  model: string
  cwd?: string
}): Promise<PsychologistOutput> {
  const { plan, seed, iterationNumber, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const prompt = [
    `Plan:\n${plan}`,
    `Seed (original situation from Sasha's life):\n${seed}`,
    `Iteration number: ${iterationNumber}`,
  ].join('\n\n')

  return runAgent({
    skillName: 'psychologist',
    model,
    prompt,
    outputSchema: PsychologistOutputSchema,
    ...cwdArg,
  })
}
