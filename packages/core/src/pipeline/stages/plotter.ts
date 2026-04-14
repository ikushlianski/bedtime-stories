import { claudeCliRunner } from '../../ai'
import type { CriticOutput } from '../schemas'

const PLOTTER_SYSTEM_PROMPT = `You are a story plotter for a bedtime therapeutic tale for a 6-year-old boy named Gosha (Sasha).
Your job is to produce a detailed story plan in plain text that will be the foundation for a story written in Russian.
The plan must include:
- Emotional task (the real-life situation the story addresses — be specific about what Sasha needs to explore)
- Characters (2-4 main characters with distinct personalities, often including an animal or magical element children enjoy)
- Setting (familiar or slightly fantastical, calming for bedtime)
- Scene-by-scene structure (5-7 scenes with clear progression)
- Humor/engagement moments (where the child will feel delighted, surprised, or amused)
- Sensory details for the writer to emphasize (sounds, textures, warmth)
- An ending type (open, hopeful, or resolved)
Do NOT write the story text itself — only the plan.
Do NOT include morals stated explicitly. The child must arrive at conclusions through experiencing the story.
Return only the plan text in plain language, no JSON, no commentary.`

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

  return claudeCliRunner.runText({ model, prompt, ...cwdArg })
}
