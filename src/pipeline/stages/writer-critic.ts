import { runAgent } from '../agent-runner'
import { CriticOutputSchema, type CriticOutput, type PsychologistOutput } from '../schemas'

export async function runWriterCritic(options: {
  textV1: string
  psychologistOutput: PsychologistOutput
  finalPlan: string
  model: string
  cwd?: string
}): Promise<CriticOutput> {
  const { textV1, psychologistOutput, finalPlan, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const prompt = [
    `Story text v1:\n${textV1}`,
    `Psychologist assessment of this text:\n${JSON.stringify(psychologistOutput, null, 2)}`,
    `Final approved plan (for checking story matches plan):\n${finalPlan}`,
  ].join('\n\n')

  return runAgent({
    skillName: 'writer-critic',
    model,
    prompt,
    outputSchema: CriticOutputSchema,
    ...cwdArg,
  })
}
