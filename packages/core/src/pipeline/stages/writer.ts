import { aiRunner } from '../../ai'
import { resolvePrompt, type ResolvedPrompt } from '../prompt-resolver'
import { buildWordsBlock, type TargetWord } from './words-block'
import { buildMemorableMomentsBlock, type MemorableMomentRow } from './memorable-moments'
import { selectStoryStructure, buildStructureBlock, type StoryStructure } from './story-structures'
import { selectCharacterLens, buildCharacterLensBlock, type CharacterLens } from './character-lenses'
import { selectVoiceRegister, buildVoiceBlock, type VoiceRegister } from './voice-registers'
import type { CriticOutput } from '../schemas'
import type { Exemplar } from '../load-exemplars'
import type { ChosenFragment } from '../load-fragments'

const WRITER_TEMPERATURE = 0.9

export const WRITER_SYSTEM_PROMPT_DEFAULT = `You are a writer creating a bedtime therapeutic story for a 6-year-old boy named Gosha (Sasha).
Write the full story text in Russian based on the plan provided. Requirements:
- Language: Russian only. Use warm, vivid, conversational language suitable for reading aloud to a child.
- Length: 800–1200 words
- Humor distribution: Include at least one genuinely funny beat (not just a mild observation) every 200–250 words — physical comedy, an absurd misunderstanding, a mismatch between how a character sees something and how it really is, an unexpected comparison, or invented wordplay. Vary the TYPE of joke across the story — don't lean on the same comic device twice. Do not save all humor for one scene or the postscript — humor must work throughout the story.
- Verbal invention: At least once, let a character or the narrator invent a word or give something an unexpected childlike name (the way a 6-year-old would). Pure situational humor is not enough.
- Idioms: Use 1–2 natural Russian idiomatic expressions per story. Pick different ones each time — do not default to the same handful of examples across stories (a large, living language has hundreds of natural options; treat any idiom you've reached for recently as off-limits for this story). Occasionally — not in every story — build a light joke on Gosha taking the idiom literally. Never do this more than once per story, and not in every story — vary whether you use it or not so it stays fresh.
- Postscript: A P.S. is optional. If used, it must NOT be the primary or only humor in the story. The main text must stand on its own comedically.
- Engagement: Use sensory language (sounds, textures, colors), repetition of catchy phrases, rhythm in dialogue. Make the child eager to know what happens next.
- Characters: Give them distinctive voices and mannerisms so a 6-year-old remembers them easily. At least one character must hold a different opinion from Gosha and not agree immediately — friction makes the story feel real. Follow the plan's scene placement for when each character first appears — never narrate a character's arrival as random, unexplained, or self-consciously sudden (e.g. "и тут вдруг появился Юра — он всегда появляется будто из ниоткуда"). If a character shows up, the setup earlier in the story should already make their presence expected, not surprising to the narrator itself.
- Siblings: If Mira appears, let her bicker with Gosha the way real siblings do — but she must come through for him when it matters. Her support should feel warmer and more valuable than any adult's.
- Consequences: If Gosha makes a wrong choice, let the consequences breathe for several paragraphs before the situation resolves. Do not fix things too quickly.
- No explicit moral stated by any character or by Gosha himself — not even in internal monologue. Sasha arrives at conclusions through experiencing the story, never through formulating them.
- Include at least one physical/bodily sensation (touch, warmth, sound, taste) — not internal monologue.
- Movement: give the story visible momentum — characters go somewhere, do something, physically interact with the world across most paragraphs. Never let internal reflection alone carry more than 2–3 consecutive sentences; follow a feeling with something happening.
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
  fallback?: string
  resolvedPrompt?: ResolvedPrompt
  universeSystemPrompt?: string
  universeContext?: string
  styleGuide?: string
  sashaContext?: string | null
  memorableMoments?: MemorableMomentRow[]
  structure?: StoryStructure
  characterLens?: CharacterLens
  voice?: VoiceRegister
  exemplars?: Exemplar[]
  referenceStory?: { title: string; textFinal: string }
  chosenFragments?: ChosenFragment[]
  targetWords?: TargetWord[]
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
    ? `\n\n---\nКОНТЕКСТ ВСЕЛЕННОЙ (персонажи, события, темы вселенной или вселенных истории):\n${options.universeContext}\n---\n`
    : ''

  const styleGuideBlock = options.styleGuide
    ? `\n\n---\nСТИЛЬ ИСТОРИЙ (чему учат примерные истории — пиши в этом духе):\n${options.styleGuide}\n---\n`
    : ''

  const sashaContextBlock = options.sashaContext
    ? `\n\n---\nКОНТЕКСТ САШИ (используй для вдохновения, не копируй буквально):\n${options.sashaContext}\n---\n`
    : ''

  const memorableMomentsBlock = buildMemorableMomentsBlock(options.memorableMoments ?? [])

  const structureBlock = buildStructureBlock(options.structure ?? selectStoryStructure(options.storyId))
  const characterLensBlock = buildCharacterLensBlock(options.characterLens ?? selectCharacterLens(options.storyId))
  const voiceBlock = buildVoiceBlock(options.voice ?? selectVoiceRegister(options.storyId))

  const exemplarsBlock = options.exemplars && options.exemplars.length > 0
    ? `\n\n---\nКАНОНИЧЕСКИЕ ПРИМЕРЫ (эталонные истории — следуй тону, ритму, юмору и структуре; не копируй сюжет):\n${options.exemplars
        .map((ex, i) => `[ПРИМЕР ${i + 1}: «${ex.title || 'без названия'}»]\n${ex.textFinal}`)
        .join('\n\n---\n\n')}\n---\n`
    : ''

  if (options.referenceStory) {
    console.log(`[WRITER] using reference story «${options.referenceStory.title}»`)
  }

  const referenceStoryBlock = options.referenceStory
    ? `\n\n---\nИСТОРИЯ-ССЫЛКА (пользователь явно попросил учитывать её при создании этой истории — не копируй персонажей из неё автоматически, если они не относятся к текущей вселенной, но учти её сюжет/тему/тон/события как контекст):\n[«${options.referenceStory.title}»]\n${options.referenceStory.textFinal}\n---\n`
    : ''

  const fragmentBlock = options.chosenFragments && options.chosenFragments.length > 0 && !isRevision
    ? `\n\n---\nФРАГМЕНТЫ ДЛЯ ВПЛЕТЕНИЯ (родитель хотел увидеть эти детали — впиши каждую органично и естественно, не выпячивая и не сваливая в одну сцену; если это короткая фраза или образ — сохрани её узнаваемой):\n${options.chosenFragments.map((f) => (f.exactQuote ? `- [ДОСЛОВНАЯ ЦИТАТА — вставь эту фразу СЛОВО В СЛОВО, без пересказа и замены синонимами] ${f.text}` : `- ${f.text}`)).join('\n')}\n---\n`
    : ''

  const endingRuleBlock = '\n\n---\nПРО КОНЦОВКУ: не заканчивай историю тем, что кто-то говорит что-то смешное и все вокруг начинают смеяться — этот приём приелся и повторяется из истории в историю. Юмор распределяй по всему тексту, а финал строй строго по типу развязки из плана (open / hopeful / resolved). Концовка каждой истории должна ощущаться по-своему, а не сводиться к общему смеху.\n---\n'

  const idiomRuleBlock = '\n\n---\nОБРАЗНЫЕ ВЫРАЖЕНИЯ: вплетай в каждую историю от одного до трёх устойчивых образных выражений — таких как «голова раскалывается», «вертится на языке», «на носу праздник», «глаза на мокром месте», «ушки на макушке», «душа в пятки ушла», «как снег на голову», «кот наплакал». Ребёнок должен постепенно к ним привыкать. Вставляй их естественно, по ходу речи персонажей или рассказчика. Если выражение не ложится органично — НЕ придумывай ради него лишние строчки или сюжетные повороты; лучше меньше, но к месту. Старайся каждый раз брать РАЗНЫЕ выражения, а не повторять одни и те же из истории в историю.\n---\n'

  const emotionRuleBlock = '\n\n---\nЯЗЫК ЧУВСТВ: ЗАПРЕЩЕНО описывать внутреннее состояние Гоши расплывчатыми штампами вроде «внутри что-то бумкнуло», «внутри ёкнуло», «что-то сжалось внутри» — это повторяется из истории в историю и ничего не называет конкретно. Вместо этого называй чувство по имени и через конкретное, узнаваемое для шестилетки телесное ощущение или действие. Примеры разных чувств (не копируй дословно, комбинируй и придумывай похожие): страх — «ноги стали тяжёлыми, как будто приросли к полу»; смущение — «щёки вспыхнули, и захотелось стать маленьким-маленьким»; восторг — «он подпрыгнул на месте, не удержавшись»; досада/злость — «кулаки сжались сами собой, а губы сложились в тонкую линию»; грусть — «в горле встал колючий комок, и глаза защипало»; гордость — «спина сама выпрямилась, а на лице расползлась улыбка». Каждый раз выбирай своё, конкретное чувство и своё телесное проявление под ситуацию — не подставляй один и тот же шаблон в разные истории.\n---\n'

  const wordsBlock = options.targetWords && options.targetWords.length > 0 && !isRevision
    ? buildWordsBlock(options.targetWords)
    : ''

  const parts: string[] = [
    `${basePrompt}${universeContextBlock}${styleGuideBlock}${sashaContextBlock}${memorableMomentsBlock}${structureBlock}${characterLensBlock}${voiceBlock}${exemplarsBlock}${referenceStoryBlock}${fragmentBlock}${wordsBlock}${endingRuleBlock}${idiomRuleBlock}${emotionRuleBlock}`,
    '',
    `STORY PLAN:\n${plan}`,
  ]

  if (isRevision) {
    parts.push(`\nPREVIOUS VERSION OF THE STORY (revise this — do not write from scratch):\n${options.previousText}`)
  }

  if (options.userAnnotations) {
    parts.push(`\nEDITOR NOTES — apply ALL of these without exception; preserve everything else in the story unchanged. Some notes are phrased as open questions (e.g. "what ideas do you have for X?") rather than direct instructions — you are a one-shot story generator, not a conversational partner, so treat every note, question or not, as something you must resolve yourself: make the best creative decision and commit to it fully in the rewritten story. NEVER respond with a list of options, a "here are a few ideas" discussion, or anything other than the complete, finished story text (e.g. do not write something like "Вот несколько вариантов, куда можно перенести действие... Вариант А... Вариант Б..." — pick one and write the story):\n${options.userAnnotations}`)
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
  const fallbackArg = options.fallback !== undefined ? { fallback: options.fallback } : {}

  return aiRunner.runText({ model, prompt, label: `writer:v${resolved.version}`, stage: 'writer', temperature: WRITER_TEMPERATURE, ...cwdArg, ...onChunkArg, ...onChunkResetArg, ...storyIdArg, ...fallbackArg })
}
