import { aiRunner } from '../../ai'
import { resolvePrompt, type ResolvedPrompt } from '../prompt-resolver'
import { buildFragmentsBlock, type EligibleFragment } from '../load-fragments'
import type { CriticOutput } from '../schemas'

export interface StoryStructure {
  title: string
  description: string
  ending: string
}

export const STORY_STRUCTURES: StoryStructure[] = [
  {
    title: 'СНЕЖНЫЙ КОМ',
    description: 'Маленькая деталь тянет за собой всё большие последствия, нарастает как снежный ком. Не катастрофа, а цепочка нелепостей.',
    ending: 'Разрядка в конце — через неожиданный поворот, который распутывает всю цепочку.',
  },
  {
    title: 'ПАРАЛЛЕЛЬНЫЕ ДОРОЖКИ',
    description: 'Два персонажа делают одно и то же по-разному (Гоша — так, кто-то ещё — иначе). Истории идут рядом и сходятся в одной точке.',
    ending: 'Контраст в финале говорит сам за себя, без объяснений — читатель сам видит разницу.',
  },
  {
    title: 'ЛОЖНЫЙ ВЫВОД',
    description: 'Герой уверен, что понял, как устроен мир, и действует исходя из этого. Оказывается не прав.',
    ending: 'Правда открывается через событие, а не через слова взрослого; герой тихо пересматривает своё.',
  },
  {
    title: 'СВИДЕТЕЛЬ',
    description: 'Герой наблюдает за тем, что происходит с другими, и через их ситуацию проживает что-то своё.',
    ending: 'Ничего не формулируется вслух — герой уходит с новым чувством, а не с выводом.',
  },
  {
    title: 'ПРЕДМЕТ КАК ОСЬ',
    description: 'Физический предмет (монетка, рыбка, шашка, записка) переходит из рук в руки и каждый раз меняет значение.',
    ending: 'Предмет в финале оказывается не там и не тем, чем казался вначале.',
  },
  {
    title: 'МИССИЯ С ПРЕПЯТСТВИЯМИ',
    description: 'Герой идёт за чем-то конкретным. Несколько вещей идут не так.',
    ending: 'Приходит не туда, куда планировал, — но именно туда, куда было надо.',
  },
  {
    title: 'ПЕРЕВОРОТ',
    description: 'То, что казалось поражением, оказывается победой; или наоборот. Ставки переворачиваются ближе к концу.',
    ending: 'Переворот происходит через событие в конце, не через объяснение.',
  },
  {
    title: 'КОЛЬЦО',
    description: 'История возвращается туда, где началась: та же сцена, то же место — но всё поменяло смысл. Повтор начальной ситуации с новым содержанием.',
    ending: 'Финальная сцена рифмуется с первой, и разница между ними и есть суть.',
  },
  {
    title: 'МАЛЕНЬКОЕ РАССЛЕДОВАНИЕ',
    description: 'Есть небольшая загадка (куда делось? кто это сделал? почему так?). Герой собирает улики и замечает мелочи.',
    ending: 'Разгадка приходит через наблюдательность героя, а не через подсказку взрослого; иногда часть тайны остаётся.',
  },
  {
    title: 'ТРИ ПОПЫТКИ',
    description: 'Герой пробует справиться с одним и тем же трижды, каждый раз по-новому. Ритм повтора с нарастанием.',
    ending: 'На третий раз получается — но неожиданным способом, не тем, что герой задумывал.',
  },
]

export function selectStoryStructure(storyId?: number): StoryStructure {
  const index =
    storyId !== undefined && storyId >= 0
      ? storyId % STORY_STRUCTURES.length
      : Math.floor(Math.random() * STORY_STRUCTURES.length)

  return STORY_STRUCTURES[index] as StoryStructure
}

export function buildStructureBlock(structure: StoryStructure): string {
  return [
    '\n\n---',
    'СТРУКТУРА ИМЕННО ЭТОЙ ИСТОРИИ (выбор уже сделан за тебя — используй ровно эту структуру, меню структурных паттернов выше игнорируй):',
    `Паттерн: ${structure.title}`,
    `Скелет: ${structure.description}`,
    `Развязка: ${structure.ending}`,
    '',
    'Нанизывай заданную тему (SEED) именно на этот скелет. Композиция должна отчётливо отличаться от структуры соседних историй — не своди всё к привычной схеме.',
    'ЗАПРЕЩЁННАЯ КОНЦОВКА: не заканчивай историю тем, что кто-то говорит что-то смешное и все вокруг начинают смеяться. Этот приём уже приелся. Юмор распределяй по ходу истории, а финал делай в духе выбранной структуры (см. «Развязка» выше), а не через общий смех.',
    '---\n',
  ].join('\n')
}

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

  const structureBlock = buildStructureBlock(selectStoryStructure(options.storyId))

  const parts: string[] = [
    `${basePrompt}${structureBlock}${universeContextBlock}${styleGuideBlock}${sashaContextBlock}${fragmentsBlock}`,
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

  return aiRunner.runText({ model, prompt, label: `plotter:v${resolved.version}`, stage: 'plotter', ...cwdArg, ...storyIdArg })
}
