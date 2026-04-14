import { claudeCliRunner } from '../../ai'
import { PsychologistOutputSchema, type PsychologistOutput } from '../schemas'

export async function runPsychologist(options: {
  content: string
  contentType: 'plan' | 'text'
  seed: string
  iterationNumber: number
  model: string
  cwd?: string
}): Promise<PsychologistOutput> {
  const { content, contentType, seed, iterationNumber, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const label = contentType === 'plan' ? 'Story plan (from plotter)' : 'Written story text (from writer)'

  const prompt = [
    `Content type: ${contentType}`,
    `${label}:\n${content}`,
    `Seed (original situation from Sasha's life):\n${seed}`,
    `Iteration number: ${iterationNumber}`,
  ].join('\n\n')

  return claudeCliRunner.runStructured({
    skill: 'psychologist',
    model,
    prompt,
    outputSchema: PsychologistOutputSchema,
    ...cwdArg,
  })
}
