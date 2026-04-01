import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import type { CriticOutput } from '../schemas'

const PLOTTER_SYSTEM_PROMPT = `You are a story plotter for a bedtime therapeutic tale for a 6-year-old boy named Gosha (Sasha).
Your job is to produce a detailed story plan in plain text. The plan must include:
- Emotional task (the real-life situation the story addresses)
- Characters and setting
- Scene-by-scene structure
- An ending type (open, hopeful, or resolved)
Do NOT write the story text itself — only the plan.
Do NOT include morals stated explicitly. The child must arrive at conclusions through experiencing the story.
Return only the plan text, no JSON, no commentary.`

class PlotterExecutionError extends Error {
  constructor(detail: string) {
    super(`Plotter execution failed: ${detail}`)
  }
}

export async function runPlotter(options: {
  seed: string
  previousPlan?: string
  criticNotes?: CriticOutput
  model: string
  promptVersion: number
  cwd?: string
}): Promise<string> {
  const { seed, previousPlan, criticNotes, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const parts: string[] = [
    PLOTTER_SYSTEM_PROMPT,
    '',
    `SEED (real-life situation to base the story on):\n${seed}`,
  ]

  if (previousPlan !== undefined) {
    parts.push(`\nPREVIOUS PLAN (revise based on critic notes below):\n${previousPlan}`)
  }

  if (criticNotes !== undefined) {
    const mustIssues = criticNotes.issues
      .filter((i) => i.prio === 'must')
      .map((i) => `- ${i.description}`)
      .join('\n')

    const niceIssues = criticNotes.issues
      .filter((i) => i.prio === 'nice')
      .map((i) => `- ${i.description}`)
      .join('\n')

    const critiqueSection = [
      'CRITIC NOTES (must address before writing the plan):',
      mustIssues.length > 0 ? `Must fix:\n${mustIssues}` : '',
      niceIssues.length > 0 ? `Nice to fix:\n${niceIssues}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    parts.push(`\n${critiqueSection}`)
  }

  const prompt = parts.join('\n')

  let resultText = ''

  const messages = query({
    prompt,
    options: {
      model,
      ...cwdArg,
      tools: [],
      permissionMode: 'dontAsk',
      persistSession: false,
    },
  })

  for await (const msg of messages as AsyncIterable<SDKMessage>) {
    if (msg.type === 'result') {
      if (msg.subtype !== 'success') {
        throw new PlotterExecutionError(`subtype=${msg.subtype}`)
      }

      resultText = msg.result
    }
  }

  if (!resultText) {
    throw new PlotterExecutionError('no result received')
  }

  return resultText
}
