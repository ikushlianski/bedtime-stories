import { claudeCliRunner } from '../../ai'
import type { CriticOutput } from '../schemas'

const WRITER_SYSTEM_PROMPT = `You are a writer creating a bedtime therapeutic story for a 6-year-old boy named Gosha (Sasha).
Write the full story text based on the plan provided. Requirements:
- Length: 800–1200 words
- Language: warm, vivid, readable aloud
- No explicit moral stated by any character — Gosha arrives at conclusions through action
- Include at least one physical/bodily sensation (not internal monologue)
- No dialogue runs longer than 3 exchanges without narrative between them
- Ending must match the plan's ending type
Return only the story text, no commentary.`

export async function runWriter(options: {
  plan: string
  criticNotes?: CriticOutput
  model: string
  promptVersion: number
  cwd?: string
}): Promise<string> {
  const { plan, criticNotes, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const parts: string[] = [
    WRITER_SYSTEM_PROMPT,
    '',
    `STORY PLAN:\n${plan}`,
  ]

  if (criticNotes !== undefined) {
    const mustIssues = criticNotes.issues
      .filter((i) => i.prio === 'must')
      .map((i) => `- ${i.description}${i.quote !== undefined ? ` (re: "${i.quote}")` : ''}`)
      .join('\n')

    const niceIssues = criticNotes.issues
      .filter((i) => i.prio === 'nice')
      .map((i) => `- ${i.description}${i.quote !== undefined ? ` (re: "${i.quote}")` : ''}`)
      .join('\n')

    const critiqueSection = [
      'REVISION NOTES (from critic — address these in the rewrite):',
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
