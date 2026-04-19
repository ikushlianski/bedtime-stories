import { claudeCliRunner } from '../../ai'
import { CriticOutputSchema, type CriticOutput } from '../schemas'

export async function runWriterCritic(options: {
  textV1: string
  finalPlan: string
  model: string
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<CriticOutput> {
  const { textV1, finalPlan, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const universeContextBlock = options.universeContext
    ? `\n\n---\nКОНТЕКСТ ВСЕЛЕННОЙ:\n${options.universeContext}\n---\n`
    : ''

  const styleGuideBlock = options.styleGuide
    ? `\n\n---\nСТИЛЬ ИСТОРИЙ (чему учат примерные истории — учитывай при оценке):\n${options.styleGuide}\n---\n`
    : ''

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const basePrompt = [
    `Story text v1:\n${textV1}`,
    `Final approved plan (for checking story matches plan):\n${finalPlan}`,
  ].join('\n\n') + universeContextBlock + styleGuideBlock + sashaContextBlock

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
