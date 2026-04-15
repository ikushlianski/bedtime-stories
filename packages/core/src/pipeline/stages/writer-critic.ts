import { claudeCliRunner } from '../../ai'
import { CriticOutputSchema, type CriticOutput, type PsychologistOutput } from '../schemas'

export async function runWriterCritic(options: {
  textV1: string
  psychologistOutput: PsychologistOutput
  finalPlan: string
  model: string
  universeSystemPrompt?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<CriticOutput> {
  const { textV1, psychologistOutput, finalPlan, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const basePrompt = [
    `Story text v1:\n${textV1}`,
    `Psychologist assessment of this text:\n${JSON.stringify(psychologistOutput, null, 2)}`,
    `Final approved plan (for checking story matches plan):\n${finalPlan}`,
  ].join('\n\n') + sashaContextBlock

  const prompt = options.universeSystemPrompt
    ? `${options.universeSystemPrompt}\n\n---\n\n${basePrompt}`
    : basePrompt

  return claudeCliRunner.runStructured({
    skill: 'writer-critic',
    model,
    prompt,
    outputSchema: CriticOutputSchema,
    ...cwdArg,
  })
}
