import { aiRunner } from '../../ai'
import { resolvePrompt, type ResolvedPrompt } from '../prompt-resolver'
import { buildFragmentsBlock, type EligibleFragment } from '../load-fragments'
import { selectStoryStructure, buildStructureBlock, type StoryStructure } from './story-structures'
import { selectStorySetting, buildSettingBlock } from './story-settings'
import { selectCharacterLens, buildCharacterLensBlock, type CharacterLens } from './character-lenses'
import { buildCharacterBibleBlock, type CharacterBibleEntry } from './character-bible-block'
import { buildReactionPreferenceBlock, type ReactionSummary } from './reaction-preferences'
import { buildMemorableMomentsBlock, type MemorableMomentRow } from './memorable-moments'
import type { CriticOutput } from '../schemas'

const PLOTTER_TEMPERATURE = 0.95

export const PLOTTER_SYSTEM_PROMPT_DEFAULT = `You are the editor-in-chief of a Belarusian children's magazine. A writer has come to you with a story idea. Your job is to sketch a rough story outline — a working brief for the writer, not a draft of the story itself.

The outline must be SHORT: a few bullet points per section, plain language, no prose passages. Think of it as an internal editorial memo.

СТРУКТУРНЫЙ ПАТТЕРН (choose one, vary between stories — do not default to the same structure every time)

Pick the pattern that best fits the seed. State which one you chose at the top of the outline.

A. СНЕЖНЫЙ КОМ — маленькая деталь тянет за собой всё большие последствия, нарастает как снежный ком. Не катастрофа, а цепочка нелепостей. Разрядка в конце — через смех или неожиданный поворот.

B. ПАРАЛЛЕЛЬНЫЕ ДОРОЖКИ — два персонажа делают одно и то же по-разному (Гоша — так, кто-то ещё — иначе). Истории сходятся в одной точке. Контраст говорит сам за себя, без объяснений.

C. ЛОЖНЫЙ ВЫВОД — Гоша уверен, что понял как устроен мир. Действует исходя из этого. Оказывается не прав — и узнаёт об этом через событие, а не через слова взрослого.

D. СВИДЕТЕЛЬ — Гоша наблюдает за тем, что происходит с другими. Через их ситуацию проживает что-то своё. Ничего не формулирует вслух.

E. ПРЕДМЕТ КАК ОСЬ — физический предмет (деньги, рыбка, шашка, записка) переходит из рук в руки и каждый раз меняет значение. Предмет скрепляет историю лучше любого персонажа.

F. МИССИЯ С ПРЕПЯТСТВИЯМИ — Гоша идёт за чем-то конкретным. Несколько вещей идут не так. Приходит не туда, куда планировал — но именно туда, куда надо.

G. ПЕРЕВОРОТ — то, что казалось поражением, оказывается победой; или наоборот. Переворот происходит через событие в конце, не через объяснение.

Anti-patterns — НИКОГДА не делай этого:
- Не открывай историю с Гошей в одиночестве, который думает или чувствует. Начинай с действия или диалога.
- Не заканчивай историю фразой типа "и я понял" / "теперь я знаю" / "я осознал" — это мораль вслух.
- Не используй P.S. в каждой истории. Он должен появляться редко, как сюрприз.
- Не повторяй структурный паттерн в двух историях подряд.

Required sections:

ЭМОЦИОНАЛЬНАЯ ЗАДАЧА
One sentence: what real-life situation does this story address for Sasha (6-year-old boy)? What will he feel or understand by the end?

ПЕРСОНАЖИ
2–4 characters. One line each: name, key trait, role in the story. At least one should be funny or quirky.
At least one character must hold an opposing view to Gosha and maintain it across several scenes — not cave immediately.

МЕСТО И ВРЕМЯ
One sentence. Familiar or mildly fantastical. Calming for bedtime.

СЦЕНЫ (5–7 сцен)
Very brief: scene title + what happens + emotional beat. No dialogue, no descriptions.
If Gosha makes a wrong choice, consequences must persist for at least 2–3 scenes before resolving.

МОМЕНТЫ СМЕХА
This section is MANDATORY. List every funny moment in the story. For each one:
- What happens
- Type of humor: one of — абсурд, словесная игра, неожиданный поворот, физическая комедия, тёплая нелепость, детская логика
- Intensity: лёгкая улыбка / смех / хохот
- Which scene it belongs to

Rules for this section:
- Humor must be spread across DIFFERENT scenes, not piled into one.
- At least one moment must be verbal: an invented compound word, a childlike renaming, or unexpected wordplay — not only physical action.
- Do NOT plan humor only in a postscript. The main story must carry the humor on its own.

РАЗВЯЗКА
One sentence: how does it end? Open / hopeful / resolved.
A small unanswered question or unexplained detail is welcome — something the child can keep thinking about.

Rules:
- Do NOT write story text, dialogue, or descriptions — only the outline.
- Do NOT state the moral explicitly. The child discovers it through events.
- Science hook (optional but welcome): if the story's theme touches anything in the natural world — animals, plants, weather, physics, the human body, space — plant one real, surprising scientific fact into the outline. It should feel like a natural part of the world, not a lesson. A fact that makes a child say "wait, really?" works best. Not every story needs one; only use it when it fits organically.
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
  eligibleFragments?: EligibleFragment[]
  bibleCharacters?: CharacterBibleEntry[]
  reactionSummary?: ReactionSummary
  memorableMoments?: MemorableMomentRow[]
  structure?: StoryStructure
  characterLens?: CharacterLens
  cwd?: string
  storyId?: number
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

  const fragmentsBlock = options.eligibleFragments && options.eligibleFragments.length > 0
    ? buildFragmentsBlock(options.eligibleFragments)
    : ''

  const structureBlock = buildStructureBlock(options.structure ?? selectStoryStructure(options.storyId))
  const settingBlock = buildSettingBlock(selectStorySetting(options.storyId))
  const characterLensBlock = buildCharacterLensBlock(options.characterLens ?? selectCharacterLens(options.storyId))
  const characterBibleBlock = buildCharacterBibleBlock(options.bibleCharacters ?? [])
  const reactionBlock = options.reactionSummary ? buildReactionPreferenceBlock(options.reactionSummary) : ''
  const memorableMomentsBlock = buildMemorableMomentsBlock(options.memorableMoments ?? [])

  const parts: string[] = [
    `${basePrompt}${structureBlock}${settingBlock}${characterLensBlock}${characterBibleBlock}${reactionBlock}${memorableMomentsBlock}${universeContextBlock}${styleGuideBlock}${sashaContextBlock}${fragmentsBlock}`,
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

  const storyIdArg = options.storyId !== undefined ? { storyId: options.storyId } : {}

  return aiRunner.runText({ model, prompt, label: `plotter:v${resolved.version}`, stage: 'plotter', temperature: PLOTTER_TEMPERATURE, ...cwdArg, ...storyIdArg })
}
