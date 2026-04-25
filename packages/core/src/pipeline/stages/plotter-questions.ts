import { z } from 'zod'
import { aiRunner } from '../../ai'

const PlotterQuestionItemSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
})

const PlotterQuestionsOutputSchema = z.object({
  questions: z.array(PlotterQuestionItemSchema).min(5),
})

export type PlotterQuestionItem = z.infer<typeof PlotterQuestionItemSchema>

export async function runPlotterQuestions(options: {
  seed: string
  model: string
  universeSystemPrompt?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<PlotterQuestionItem[]> {
  const { seed, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const basePrompt = `Story seed:\n${seed}${sashaContextBlock}`

  const prompt = options.universeSystemPrompt
    ? `${options.universeSystemPrompt}\n\n---\n\n${basePrompt}`
    : basePrompt

  const result = await aiRunner.runStructured({
    skill: 'plotter-questions',
    model,
    prompt,
    outputSchema: PlotterQuestionsOutputSchema,
    thinking: { type: 'enabled', budgetTokens: 8000 },
    ...cwdArg,
  })

  return result.questions
}
