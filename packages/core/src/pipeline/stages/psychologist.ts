import { claudeCliRunner } from '../../ai'
import { PsychologistOutputSchema, type PsychologistOutput } from '../schemas'

export async function runPsychologist(options: {
  content: string
  contentType: 'plan' | 'text'
  seed: string
  iterationNumber: number
  model: string
  universeSystemPrompt?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<PsychologistOutput> {
  const { content, contentType, seed, iterationNumber, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const label = contentType === 'plan' ? 'Story plan (from plotter)' : 'Written story text (from writer)'

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---`
    : ''

  const parts = [
    `Content type: ${contentType}`,
    `${label}:\n${content}`,
    `Seed (original situation from Sasha's life):\n${seed}`,
    `Iteration number: ${iterationNumber}`,
  ]

  const basePrompt = parts.join('\n\n') + sashaContextBlock

  const prompt = options.universeSystemPrompt
    ? `${options.universeSystemPrompt}\n\n---\n\n${basePrompt}`
    : basePrompt

  return claudeCliRunner.runStructured({
    skill: 'psychologist',
    model,
    prompt,
    outputSchema: PsychologistOutputSchema,
    ...cwdArg,
  })
}
