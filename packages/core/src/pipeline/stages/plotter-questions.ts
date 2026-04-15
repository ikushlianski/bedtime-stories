import { z } from 'zod'
import { claudeCliRunner } from '../../ai'

const PlotterQuestionsOutputSchema = z.object({
  questions: z.array(z.string()).min(5),
})

export async function runPlotterQuestions(options: {
  seed: string
  model: string
  universeSystemPrompt?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<string[]> {
  const { seed, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const basePrompt = `Story seed:\n${seed}${sashaContextBlock}`

  const prompt = options.universeSystemPrompt
    ? `${options.universeSystemPrompt}\n\n---\n\n${basePrompt}`
    : basePrompt

  const result = await claudeCliRunner.runStructured({
    skill: 'plotter-questions',
    model,
    prompt,
    outputSchema: PlotterQuestionsOutputSchema,
    ...cwdArg,
  })

  return result.questions
}
