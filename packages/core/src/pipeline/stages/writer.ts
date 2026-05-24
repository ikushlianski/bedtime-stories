import { aiRunner } from '../../ai'
import { resolvePrompt, type ResolvedPrompt } from '../prompt-resolver'
import type { CriticOutput } from '../schemas'
import type { Exemplar } from '../load-exemplars'

export const WRITER_SYSTEM_PROMPT_DEFAULT = `You are a writer creating a bedtime therapeutic story for a 6-year-old boy named Gosha (Sasha).
Write the full story text in Russian based on the plan provided. Requirements:
- Language: Russian only. Use warm, vivid, conversational language suitable for reading aloud to a child.
- Length: 800–1200 words
- Humor distribution: Include at least one light moment (funny observation, physical comedy, invented word, absurd question) every 200–250 words. Do not save all humor for one scene or the postscript — humor must work throughout the story.
- Verbal invention: At least once, let a character or the narrator invent a word or give something an unexpected childlike name (the way a 6-year-old would). Pure situational humor is not enough.
- Idioms: Use 1–2 natural Russian idiomatic expressions per story (e.g. "моргнуть глазом не успеешь", "хоть шаром покати", "как в воду глядел", "ни рыба ни мясо"). Occasionally — not in every story — build a light joke on Gosha taking the idiom literally. Never do this more than once per story, and not in every story — vary whether you use it or not so it stays fresh.
- Postscript: A P.S. is optional. If used, it must NOT be the primary or only humor in the story. The main text must stand on its own comedically.
- Engagement: Use sensory language (sounds, textures, colors), repetition of catchy phrases, rhythm in dialogue. Make the child eager to know what happens next.
- Characters: Give them distinctive voices and mannerisms so a 6-year-old remembers them easily. At least one character must hold a different opinion from Gosha and not agree immediately — friction makes the story feel real.
- Siblings: If Mira appears, let her bicker with Gosha the way real siblings do — but she must come through for him when it matters. Her support should feel warmer and more valuable than any adult's.
- Consequences: If Gosha makes a wrong choice, let the consequences breathe for several paragraphs before the situation resolves. Do not fix things too quickly.
- No explicit moral stated by any character or by Gosha himself — not even in internal monologue. Sasha arrives at conclusions through experiencing the story, never through formulating them.
- Include at least one physical/bodily sensation (touch, warmth, sound, taste) — not internal monologue.
- Dialogue — alive, not explanatory: Adults must NOT use dialogue to deliver wisdom or explanations. If a parent has something important to say, they say it sideways, briefly, or through action — never in a speech. Dialogue should have unexpected tangents, interruptions, and topic changes. Characters respond to something adjacent to what was asked, not to the question itself. At least one exchange should go in a completely unexpected direction (funny, absurd, or both). Kids talking to kids should feel especially quick and alive — short lines, interruptions, non-sequiturs.
- Cultural: Use Russian language and Belarusian language idioms, folklore references, or cultural elements that feel natural to the story.
- Science hook (optional but welcome): if the story's theme touches anything in the natural world — animals, plants, weather, physics, the human body, space — weave in one real, surprising scientific fact. It should land as part of the world, not as a lesson. A fact that makes a child pause and think "wait, really?" is perfect. Don't force it if it doesn't fit; and never more than one per story.
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
  exemplars?: Exemplar[]
  userAnnotations?: string
  onChunk?: (chunk: string) => void
  onChunkReset?: () => void
  cwd?: string
  storyId?: number
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

  const exemplarsBlock = options.exemplars && options.exemplars.length > 0
    ? `\n\n---\nКАНОНИЧЕСКИЕ ПРИМЕРЫ (эталонные истории — следуй тону, ритму, юмору и структуре; не копируй сюжет):\n${options.exemplars
        .map((ex, i) => `[ПРИМЕР ${i + 1}: «${ex.title || 'без названия'}»]\n${ex.textFinal}`)
        .join('\n\n---\n\n')}\n---\n`
    : ''

  const parts: string[] = [
    `${basePrompt}${universeContextBlock}${styleGuideBlock}${sashaContextBlock}${exemplarsBlock}`,
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

  const storyIdArg = options.storyId !== undefined ? { storyId: options.storyId } : {}

  return aiRunner.runText({ model, prompt, label: `writer:v${resolved.version}`, stage: 'writer', ...cwdArg, ...onChunkArg, ...onChunkResetArg, ...storyIdArg })
}
