import { claudeCliRunner } from '../../ai'
import { resolvePrompt, type ResolvedPrompt } from '../prompt-resolver'
import type { CriticOutput } from '../schemas'

export const WRITER_SYSTEM_PROMPT_DEFAULT = `You are a writer creating a bedtime therapeutic story for a 6-year-old boy named Gosha (Sasha).
Write the full story text in Russian based on the plan provided. Requirements:
- Language: Russian only. Use warm, vivid, conversational language suitable for reading aloud to a child.
- Length: 800–1200 words
- Humor: Include playful, age-appropriate humor (silly situations, wordplay, unexpected moments) that will make Sasha smile or giggle.
- Engagement: Use sensory language (sounds, textures, colors), repetition of catchy phrases, rhythm in dialogue. Make the child eager to know what happens next.
- Characters: Give them distinctive voices and mannerisms so a 6-year-old remembers them easily.
- No explicit moral stated by any character — Sasha arrives at conclusions through experiencing the story.
- Include at least one physical/bodily sensation (touch, warmth, sound, taste) — not internal monologue.
- Dialogue: No dialogue runs longer than 3 exchanges without narrative between them.
- Cultural: Use Russian language and Belarusian language idioms, folklore references, or cultural elements that feel natural to the story.
- Ending must match the plan's ending type (open, hopeful, or resolved).
Return only the story text in Russian, no commentary or meta-discussion.`

export async function runWriter(options: {
  plan: string
  previousText?: string
  criticNotes?: CriticOutput
  model: string
  resolvedPrompt?: ResolvedPrompt
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  userAnnotations?: string
  onChunk?: (chunk: string) => void
  onChunkReset?: () => void
  cwd?: string
}): Promise<string> {
  const { plan, criticNotes, model } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
  const isRevision = options.previousText !== undefined

  const resolved = options.resolvedPrompt ?? (await resolvePrompt('writer', WRITER_SYSTEM_PROMPT_DEFAULT))

  const basePrompt = options.universeSystemPrompt
    ? `${options.universeSystemPrompt}\n\n---\n\n${resolved.text}`
    : resolved.text

  const universeContextBlock = options.universeContext
    ? `\n\n---\nКОНТЕКСТ ВСЕЛЕННОЙ (персонажи, события, темы этой вселенной):\n${options.universeContext}\n---\n`
    : ''

  const styleGuideBlock = options.styleGuide
    ? `\n\n---\nСТИЛЬ ИСТОРИЙ (чему учат примерные истории — пиши в этом духе):\n${options.styleGuide}\n---\n`
    : ''

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const parts: string[] = [
    `${basePrompt}${universeContextBlock}${styleGuideBlock}${sashaContextBlock}`,
    '',
    `STORY PLAN:\n${plan}`,
  ]

  if (isRevision) {
    parts.push(`\nPREVIOUS VERSION OF THE STORY (revise this — do not write from scratch):\n${options.previousText}`)
  }

  if (options.userAnnotations) {
    parts.push(`\nEDITOR NOTES — apply ALL of these without exception; preserve everything else in the story unchanged:\n${options.userAnnotations}`)
  }

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
      isRevision
        ? 'REVISION NOTES (apply these changes to the previous version above):'
        : 'REVISION NOTES (from critic — address these in the rewrite):',
      mustIssues.length > 0 ? `Must fix:\n${mustIssues}` : '',
      niceIssues.length > 0 ? `Nice to fix:\n${niceIssues}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    console.log(`[WRITER] revision mode — ${criticNotes.issues.length} issue(s) from critic (${criticNotes.issues.filter((i) => i.prio === 'must').length} must-fix, ${criticNotes.issues.filter((i) => i.prio === 'nice').length} nice-to-fix)`)
    criticNotes.issues.forEach((issue, i) => {
      console.log(`  [${i + 1}] [${issue.prio.toUpperCase()}] ${issue.description}${issue.quote ? ` — «${issue.quote}»` : ''}`)
    })

    parts.push(`\n${critiqueSection}`)
  } else if (isRevision && options.userAnnotations) {
    console.log('[WRITER] annotation rewrite — applying editor notes directly')
  } else {
    console.log('[WRITER] first pass — writing story from plan')
  }

  const prompt = parts.join('\n')

  const onChunkArg = options.onChunk !== undefined ? { onChunk: options.onChunk } : {}
  const onChunkResetArg = options.onChunkReset !== undefined ? { onChunkReset: options.onChunkReset } : {}

  return claudeCliRunner.runText({ model, prompt, label: `writer:v${resolved.version}`, ...cwdArg, ...onChunkArg, ...onChunkResetArg })
}
