---
type: spec
branch: main
task: Vary story titles — stop overusing "Тайна"/"Волшебный"
complexity: simple
state: confirmed
updated: 2026-07-24
---

# Spec: Vary story titles

### What to do
`generateStoryTitle` in `packages/core/src/pipeline/stages/title-generator.ts` has no anti-repetition
mechanism, so the model defaults converge on "Тайна ..." (Mystery of...) and "Волшебный ..." (Magical...).
Fix this three ways:

1. Add a `loadRecentTitles(universeId, excludeStoryId?)` loader in `packages/core/src/pipeline/load-recent-titles.ts`,
   following the exact pattern of `load-memorable-moments.ts` — query `stories.title` where
   `stories.groupId = universeId`, exclude `excludeStoryId` when given, exclude rows with empty/blank
   titles, order by `createdAt desc`, limit 12. Returns `[]` when `universeId` is `null`.
2. Wire `loadRecentTitles` into both call sites in `packages/core/src/pipeline/orchestrator.ts`
   (`runPlanPhase` and `runPlotterOnly`) — both already have `options.universeId` and `options.storyId`
   in scope. Pass the resulting titles into `generateStoryTitle` as a new optional `recentTitles?: string[]` field.
3. Update the prompt in `title-generator.ts` to: explicitly forbid the words "Тайна" and "Волшебный" and
   their inflections/derivatives (regex-stem match, not an exhaustive word list, in both the prompt
   instruction and the guard), and — when `recentTitles` is non-empty — list them and instruct the model
   not to repeat their pattern/structure.
4. Add a post-generation guard: a pure `titleContainsForbiddenWord(title: string): boolean` check
   (stem-based, case-insensitive, handles Cyrillic inflection) run after the first generation. If it
   trips, retry once with a strengthened prompt that names the exact offending word and asks for a
   completely different title. Use the retry's result regardless of what it produces (no infinite loop,
   no throw) — this is a best-effort defensive layer, not a hard guarantee.

### Files to touch
```
packages/core/src/pipeline/
├── load-recent-titles.ts          (new — db loader, mirrors load-memorable-moments.ts)
├── load-recent-titles.test.ts     (new — db-mocked unit tests)
├── orchestrator.ts                (modify — call loadRecentTitles in runPlanPhase + runPlotterOnly, pass recentTitles through)
└── stages/
    ├── title-generator.ts         (modify — forbidden-word prompt instructions, recentTitles context, retry guard)
    └── title-generator.test.ts    (new — prompt content assertions + retry-guard behavior)
```

### Done when
- `generateStoryTitle` accepts an optional `recentTitles?: string[]` and, when provided, the built
  prompt lists them and instructs the model to avoid repeating their pattern.
- The prompt always explicitly forbids "Тайна"/"Волшебный" and inflected forms, regardless of whether
  `recentTitles` was passed.
- If the first AI response contains a forbidden word/stem, `generateStoryTitle` retries once with a
  strengthened prompt naming the offending word, then returns whatever the retry produces (never throws,
  never loops more than once).
- `orchestrator.ts`'s two call sites fetch recent titles for the story's universe (up to 12, excluding
  the current story) and pass them through; when `universeId` is `null`/absent, `recentTitles` is empty
  and behavior is unchanged from today.
- `npx tsc --noEmit` is clean.
- `npx vitest run packages/core/src/pipeline/stages/title-generator.test.ts packages/core/src/pipeline/load-recent-titles.test.ts` passes.
- Full `npx vitest run` passes with no regressions.

### Decisions made autonomously
- Scope of "recent titles" is same-universe (`stories.groupId`), last 12, excluding the current story —
  matches the existing `load-memorable-moments.ts` scoping convention and is what the user actually
  experiences titles within (a universe/series). Global scope was rejected: stories in unrelated
  universes have no bearing on what reads as repetitive to the reader.
- Forbidden-word matching uses a Cyrillic stem check (e.g. `/тайн/i`, `/волшебн/i`) rather than an
  exhaustive inflection list — Russian inflects heavily and a stem match is both simpler and more robust
  than enumerating every case/gender form.
- Retry guard is single-shot (max one retry), never throws, and always returns a title — a persistent
  forbidden word after retry is logged-worthy but not worth blocking story generation over, consistent
  with this being a best-effort defensive layer per the task description.
- No new DB columns/migrations — this reuses the existing `stories.title` and `stories.groupId` columns.

### Scope boundary
- No changes to the Plotter/Writer stages or any other prompt.
- No changes to how titles are stored, edited, or displayed in the UI.
- No admin-configurable forbidden-word list — the two words named by the user are hardcoded constants.
