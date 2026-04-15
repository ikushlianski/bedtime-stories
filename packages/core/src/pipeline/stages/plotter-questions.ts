import { z } from 'zod'
import { claudeCliRunner } from '../../ai'

const PlotterQuestionsOutputSchema = z.object({
  questions: z.array(z.string()).min(5),
})

export async function runPlotterQuestions(options: {
  seed: string
  model: string
  universeSystemPrompt?: string
  cwd?: string
}): Promise<string[]> {
  const { seed, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const basePrompt = `Story seed:\n${seed}`

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
