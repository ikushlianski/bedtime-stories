import { aiRunner } from '../../ai'
import { CriticOutputSchema, type CriticOutput } from '../schemas'

export async function runWriterCritic(options: {
  textV1: string
  finalPlan: string
  model: string
  fallback?: string
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  userAnnotations?: string
  cwd?: string
}): Promise<CriticOutput> {
  const { textV1, finalPlan, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const fallbackArg = options.fallback !== undefined ? { fallback: options.fallback } : {}

  if (options.userAnnotations) {
    console.log(`[WRITER-CRITIC] received ${options.userAnnotations.split('\n\n').filter(Boolean).length} annotation(s) from editor — will include in critique`)
  } else {
    console.log('[WRITER-CRITIC] no editor annotations — running standard critique')
  }

  const universeContextBlock = options.universeContext
    ? `\n\n---\nКОНТЕКСТ ВСЕЛЕННОЙ:\n${options.universeContext}\n---\n`
    : ''

  const styleGuideBlock = options.styleGuide
    ? `\n\n---\nСТИЛЬ ИСТОРИЙ (чему учат примерные истории — учитывай при оценке):\n${options.styleGuide}\n---\n`
    : ''

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const userAnnotationsBlock = options.userAnnotations
    ? `\n\n---\nКОММЕНТАРИИ РЕДАКТОРА К ТЕКСТУ (учти при оценке):\n${options.userAnnotations}\n---\n`
    : ''

  const basePrompt = [
    `Story text v1:\n${textV1}`,
    `Final approved plan (for checking story matches plan):\n${finalPlan}`,
  ].join('\n\n') + universeContextBlock + styleGuideBlock + sashaContextBlock + userAnnotationsBlock

  const prompt = options.universeSystemPrompt
    ? `${options.universeSystemPrompt}\n\n---\n\n${basePrompt}`
    : basePrompt

  return aiRunner.runStructured({
    skill: 'writer-critic',
    model,
    prompt,
    outputSchema: CriticOutputSchema,
    ...cwdArg,
    ...fallbackArg,
  })
}
