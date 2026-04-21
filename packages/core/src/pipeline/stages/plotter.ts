import { claudeCliRunner } from '../../ai'
import { resolvePrompt, type ResolvedPrompt } from '../prompt-resolver'
import type { CriticOutput } from '../schemas'

export const PLOTTER_SYSTEM_PROMPT_DEFAULT = `You are the editor-in-chief of a Belarusian children's magazine. A writer has come to you with a story idea. Your job is to sketch a rough story outline — a working brief for the writer, not a draft of the story itself.

The outline must be SHORT: a few bullet points per section, plain language, no prose passages. Think of it as an internal editorial memo.

Required sections:

ЭМОЦИОНАЛЬНАЯ ЗАДАЧА
One sentence: what real-life situation does this story address for Sasha (6-year-old boy)? What will he feel or understand by the end?

ПЕРСОНАЖИ
2–4 characters. One line each: name, key trait, role in the story. At least one should be funny or quirky.

МЕСТО И ВРЕМЯ
One sentence. Familiar or mildly fantastical. Calming for bedtime.

СЦЕНЫ (5–7 сцен)
Very brief: scene title + what happens + emotional beat. No dialogue, no descriptions.

МОМЕНТЫ СМЕХА
This section is MANDATORY. List every funny moment in the story. For each one:
- What happens
- Type of humor: one of — абсурд, словесная игра, неожиданный поворот, физическая комедия, тёплая нелепость, детская логика
- Intensity: лёгкая улыбка / смех / хохот

РАЗВЯЗКА
One sentence: how does it end? Open / hopeful / resolved.

Rules:
- Do NOT write story text, dialogue, or descriptions — only the outline.
- Do NOT state the moral explicitly. The child discovers it through events.
- Write in Russian.
- Return only the outline, no meta-commentary.`

export async function runPlotter(options: {
  seed: string
  previousPlan?: string
  criticNotes?: CriticOutput
  userFeedback?: string
  model: string
  resolvedPrompt?: ResolvedPrompt
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  cwd?: string
}): Promise<string> {
  const { seed, previousPlan, criticNotes, userFeedback, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const resolved = options.resolvedPrompt ?? (await resolvePrompt('plotter', PLOTTER_SYSTEM_PROMPT_DEFAULT))

  const basePrompt = options.universeSystemPrompt
    ? `${options.universeSystemPrompt}\n\n---\n\n${resolved.text}`
    : resolved.text

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const universeContextBlock = options.universeContext
    ? `\n\n---\nКОНТЕКСТ ВСЕЛЕННОЙ (персонажи, события, темы этой вселенной):\n${options.universeContext}\n---\n`
    : ''

  const styleGuideBlock = options.styleGuide
    ? `\n\n---\nСТИЛЬ ИСТОРИЙ (чему учат примерные истории — учитывай при работе):\n${options.styleGuide}\n---\n`
    : ''

  const parts: string[] = [
    `${basePrompt}${universeContextBlock}${styleGuideBlock}${sashaContextBlock}`,
    '',
    `SEED (real-life situation to base the story on):\n${seed}`,
  ]

  if (previousPlan !== undefined) {
    parts.push(`\nPREVIOUS PLAN (revise based on critic notes below):\n${previousPlan}`)
  }

  if (userFeedback !== undefined) {
    parts.push(`\nPARENT FEEDBACK ON PREVIOUS PLAN (the parent has reviewed the plan and left these notes — address each one):\n${userFeedback}`)
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

  return claudeCliRunner.runText({ model, prompt, label: `plotter:v${resolved.version}`, ...cwdArg })
}
