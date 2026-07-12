# Reaction Personalization — Implementation Spec

Feed recorded child reactions back into story generation so a universe's stories
drift toward what the child actually enjoyed. Today `child_reactions` rows are
captured per story and shown in admin views, but they never influence a single
generated story.

---

## 1. Business goal (concrete scenarios)

- **Favorite character keeps showing up.** A parent repeatedly marks "Мира" as
  Sasha's favorite character across a universe's stories. New stories in that
  universe now deliberately give Мира a real role more often, instead of the cast
  being reshuffled blind to what landed.
- **More of what made him laugh.** Several stories in a universe were marked
  "was funny" and "want again". The plotter is told the child responds to humor
  in this universe and plans humor moments with a little more confidence.
- **Less of what scared or dragged.** Multiple recent stories were flagged
  "was scary" or "too long". New stories are steered toward a calmer emotional
  task and a tighter scene count, so the universe self-corrects toward the
  child's tolerance without the parent editing prompts by hand.
- **Favorite moments inform scene design.** Recorded `favorite_moment` snippets
  ("когда рыбка заговорила") are surfaced to the plotter as concrete beats the
  child loved, so it can design scenes in a similar spirit — not copy them.
- **Cold start stays neutral.** A brand-new universe with no reactions (or too
  few) generates exactly as it does today — no block is injected, nothing breaks.

Success = the plotter's cast, emotional task, scene count, and humor planning
visibly reflect the aggregate of recent reactions for that universe, while a
universe with no reaction history is unaffected.

---

## 2. Architecture (data flow)

```
child_reactions ──(join on story_id)── stories ──filter groupId = universeId
        │
        ▼
  load-reaction-preferences.ts   (core/pipeline, DB-owning loader)
    query recent N reaction rows for the universe
        │  rows
        ▼
  reaction-preferences.ts        (core/pipeline/stages, PURE, DB-free)
    summarizeReactions(rows) → ReactionSummary   (deterministic aggregation)
        │  summary
        ▼
  runPlanPhase / runPlotterOnly  (orchestrator — already receive universeId)
    call the loader by universeId, thread ReactionSummary into runPlotter
        │  reactionSummary
        ▼
  runPlotter (stages/plotter.ts)
    buildReactionPreferenceBlock(summary) → string
    appended into parts[0] AFTER resolved.text, alongside structureBlock
        │
        ▼
  Plotter LLM call — cast / emotional task / scenes / humor steered
        │  (steering propagates to the writer via the produced plan)
        ▼
  Writer (unchanged; consumes the plan)
```

Injection channel is **plotter-only**. Every reaction signal maps to a decision
the plotter already owns:

| Reaction signal | Plotter section it steers |
|---|---|
| `favoriteCharacter` (top-N) | ПЕРСОНАЖИ — cast selection |
| `favoriteMoment` (recent snippets) | СЦЕНЫ — scene design inspiration |
| `wasFunny` / `wantAgain` (high proportion) | МОМЕНТЫ СМЕХА — humor confidence |
| `wasScary` (high proportion) | ЭМОЦИОНАЛЬНАЯ ЗАДАЧА — calmer tone |
| `tooLong` (high proportion) | СЦЕНЫ — tighter scene count / arc |

The plotter is the single upstream decision point; steering it propagates into
the writer through the plan, so no writer-side injection is needed. This mirrors
`story-structures.ts` and `character-lenses.ts`, which also inject only into the
plotter.

### Why plotter, not writer, and the length caveat

`favoriteCharacter/favoriteMoment/wasFunny/wasScary` are all plan-level (cast,
tone, beats, humor placement) — they belong to the plotter unambiguously.

`tooLong` is the one signal with a writer-side lever: `writer.ts` hardcodes an
**800–1200 word budget** (`WRITER_SYSTEM_PROMPT_DEFAULT`). With plotter-only
injection, `tooLong` steering bites only by the plotter planning fewer/tighter
scenes (it emits 5–7 scenes today) — the writer's word budget is left untouched.
This is a **deliberate scope boundary**: we keep a single injection point and a
single data-threading path (the plotter already receives `universeId`; the writer
phase `runTextPhase` does not). A future writer-side word-budget nudge is
possible but intentionally out of scope here to avoid a second injection point and
double-threading. Do not imply length is fully controlled — it is nudged via
scene count only.

### Relationship to the other feedback channels (no double-counting)

Two adjacent channels already exist; this feature is deliberately distinct from
both and must not re-derive their signals:

- **Style guide (`styleGuide`, feature #3).** Learns from feedback via the
  *style* channel — abstract "what good stories in this universe do". This
  reaction block carries **concrete child preferences** (which character, which
  moment, funnier/calmer/shorter), not style abstractions. Keep them disjoint:
  the reaction block never emits style guidance.
- **Sasha context (`synthesizeSashaContext` in `feedback-synthesizer.ts`).**
  Already aggregates `favorite_moment / favorite_character / was_funny /
  too_long / want_again`, but from the **`feedback`** table — globally, and
  AI-synthesized into free-form prose. This feature reads a **different table**
  (`child_reactions`), scoped **per-universe**, and produces a **deterministic**
  block. One-sentence distinction, not a reconciliation layer: same field names,
  different source table, different scope, different (non-LLM) synthesis.

---

## 3. Data model changes

**None.** `child_reactions` (schema.ts line 237) already exists with all needed
columns: `storyId`, `enjoyed` (int), `wasFunny`, `wasScary`, `tooLong`,
`understoodMoral`, `wantAgain` (bools), `favoriteMoment`, `favoriteCharacter`,
`notes` (text), plus a unique constraint on `story_id` (one reaction per story).
It is already written by the reaction upsert in `stories.ts` (~line 1025) and
read in `admin.ts`. `stories.groupId` (schema.ts line 69) provides the universe
join key. No migration.

---

## 4. New files to create

### `packages/core/src/pipeline/stages/reaction-preferences.ts` — PURE, DB-free

Mirrors `story-structures.ts` / `character-lenses.ts`: no DB import, no env, no
`db` access. Zod for the types. No comments.

Exports:

- `ReactionRow` — Zod schema + inferred type for one input row (the subset of
  `child_reactions` columns the aggregation needs):
  `{ enjoyed, wasFunny, wasScary, tooLong, wantAgain, favoriteMoment,
  favoriteCharacter }` (nullable to match the DB shape).
- `ReactionSummary` — Zod schema + inferred type. Shape:
  ```
  {
    sampleSize: number
    topFavoriteCharacters: string[]   // most-frequent, deduped, cap N
    recentFavoriteMoments: string[]   // recent non-empty snippets, cap M
    funnyLanded: boolean              // proportion(wasFunny) >= FUNNY_FLAG
    wantAgainStrong: boolean          // proportion(wantAgain) >= WANT_AGAIN_FLAG
    tooScary: boolean                 // proportion(wasScary) >= SCARY_FLAG
    tooLong: boolean                  // proportion(tooLong) >= TOO_LONG_FLAG
  }
  ```
- `summarizeReactions(rows: ReactionRow[]): ReactionSummary` — pure aggregation.
  Counts favorite characters case-insensitively (trim, group, rank by frequency,
  take top N); collects recent non-empty favorite moments (input assumed already
  ordered newest-first by the loader, take first M); computes each boolean flag
  as `count(true) / sampleSize >= threshold`, where only non-null values count
  toward the denominator for that flag. Empty input → zeroed summary
  (`sampleSize: 0`, empty arrays, all flags false).
- `buildReactionPreferenceBlock(summary: ReactionSummary): string` — pure block
  builder, same `['\n\n---', ..., '---\n'].join('\n')` shape as
  `buildStructureBlock`. Returns `''` when `sampleSize < MIN_REACTIONS` (below
  this the loader should not have called it, but the builder is defensive). Block
  content (Russian, matching the existing blocks' register):
  - Header stating this is what THIS child enjoyed in earlier stories of this
    universe — steer toward it, do not copy it.
  - If `topFavoriteCharacters` non-empty: name them as characters the child
    loves — give at least one a real role when canon/place allows (reuse the
    same canon/place guardrail wording as `character-lenses.ts` so a preferred
    character is never dragged into an impossible scene).
  - If `recentFavoriteMoments` non-empty: list them as beats that landed — design
    scenes in a similar spirit, not verbatim.
  - If `funnyLanded` / `wantAgainStrong`: humor works for this child — plan the
    МОМЕНТЫ СМЕХА section with confidence.
  - If `tooScary`: keep the ЭМОЦИОНАЛЬНАЯ ЗАДАЧА calmer, softer stakes.
  - If `tooLong`: keep it tight — lean toward the low end of the 5–7 scene range,
    no filler scenes.

**Threshold constants** live at the top of this pure module (exported, so tests
and the loader share them): `MIN_REACTIONS`, `TOP_CHARACTERS_N`,
`RECENT_MOMENTS_M`, `FUNNY_FLAG`, `WANT_AGAIN_FLAG`, `SCARY_FLAG`,
`TOO_LONG_FLAG`. Values in §5.

### `packages/core/src/pipeline/stages/reaction-preferences.test.ts` — co-located vitest

Test cases (no `__tests__`, no comments, grouped in `describe` blocks):

`describe('summarizeReactions')`:
- returns a zeroed summary (`sampleSize: 0`, empty arrays, all flags false) for
  an empty input array.
- ranks favorite characters by frequency and caps at `TOP_CHARACTERS_N`.
- dedupes favorite characters case-insensitively ("Мира" / "мира" → one entry).
- ignores null/empty `favoriteCharacter` and `favoriteMoment` values.
- keeps recent favorite moments in input order and caps at `RECENT_MOMENTS_M`.
- sets `funnyLanded` true only when the `wasFunny` proportion meets `FUNNY_FLAG`,
  false just below it.
- sets `tooScary` / `tooLong` true when their proportion meets the flag and
  computes the proportion over non-null values only.

`describe('buildReactionPreferenceBlock')`:
- returns `''` when `sampleSize < MIN_REACTIONS`.
- names a top favorite character in the block when one is present.
- includes the canon/place guardrail wording (a preferred character must fit the
  scene) — assert the guardrail phrase is present.
- includes a calmer-tone instruction when `tooScary` is true and omits it when
  false.
- includes a tighten/short-scene instruction when `tooLong` is true.
- omits the humor-confidence line when neither `funnyLanded` nor
  `wantAgainStrong` is set.

### `packages/core/src/pipeline/load-reaction-preferences.ts` — DB loader (thin wiring)

Parallel to `load-fragments.ts`. Owns the query; contains no aggregation logic
of its own (delegates to `summarizeReactions`). Exports:

```
loadReactionPreferences(universeId: number | null): Promise<ReactionSummary>
```

- Returns the zeroed summary immediately when `universeId === null`.
- Queries recent reaction rows for the universe (SQL in §5), maps to
  `ReactionRow[]`, calls `summarizeReactions(rows)`, returns the summary.
- Re-exports the pure module (`export * from './stages/reaction-preferences'`)
  so callers get `ReactionSummary` / `buildReactionPreferenceBlock` from one
  import, matching `load-fragments.ts`'s `export * from './fragments-prompt'`.

No co-located test for the loader (DB-bound, same as `load-fragments.ts` which
has none) — all logic worth testing lives in the pure module.

---

## 5. WIRING HANDOFF (exact)

### 5a. The Drizzle query (in `load-reaction-preferences.ts`)

Join `child_reactions` → `stories` on `story_id`, filter by universe, newest
first, capped:

```ts
import { desc, eq } from 'drizzle-orm'
import { db } from '../db/client'
import { childReactions, stories } from '../db/schema'

const rows = await db
  .select({
    enjoyed: childReactions.enjoyed,
    wasFunny: childReactions.wasFunny,
    wasScary: childReactions.wasScary,
    tooLong: childReactions.tooLong,
    wantAgain: childReactions.wantAgain,
    favoriteMoment: childReactions.favoriteMoment,
    favoriteCharacter: childReactions.favoriteCharacter,
  })
  .from(childReactions)
  .innerJoin(stories, eq(childReactions.storyId, stories.id))
  .where(eq(stories.groupId, universeId))
  .orderBy(desc(childReactions.createdAt))
  .limit(REACTION_WINDOW)
```

`innerJoin` + `desc` + `.limit` all match existing usage in
`feedback-synthesizer.ts`. Newest-first ordering is what
`summarizeReactions` assumes for `recentFavoriteMoments`.

### 5b. Threshold constants (decided — do not re-open)

Anchored to the `limit(5/30/80)` recency windows already used in
`feedback-synthesizer.ts` and to the one-reaction-per-story cardinality:

| Constant | Value | Location | Rationale |
|---|---|---|---|
| `REACTION_WINDOW` | `20` | loader | recent history without drowning new signal; between feedback-synth's 5 and 30 |
| `MIN_REACTIONS` | `3` | pure module | below 3 a "proportion" is noise; suppress the whole block (cold-start neutral) |
| `TOP_CHARACTERS_N` | `2` | pure module | steer, don't dictate the whole cast |
| `RECENT_MOMENTS_M` | `3` | pure module | a few concrete beats, not a wall |
| `FUNNY_FLAG` | `0.5` | pure module | majority-of-rated signals it landed |
| `WANT_AGAIN_FLAG` | `0.5` | pure module | majority |
| `SCARY_FLAG` | `0.34` | pure module | scary is asymmetric-cost; trip earlier (≈ a third) |
| `TOO_LONG_FLAG` | `0.4` | pure module | length is a softer nudge than scary |

### 5c. Orchestrator threading (the exact edits implementation will make)

The plotter entry points already carry `universeId` (used today for
`loadEligibleFragments`). Add the loader call alongside it — no API-layer or
trigger-file changes required.

1. **`orchestrator.ts` → `runPlanPhase`** (and identically **`runPlotterOnly`**):
   after the existing `loadEligibleFragments` call, add:
   ```ts
   const reactionSummary = await loadReactionPreferences(options.universeId ?? null)
   const reactionArg = reactionSummary.sampleSize >= MIN_REACTIONS
     ? { reactionSummary }
     : {}
   ```
   and spread `...reactionArg` into the `runPlotter({ ... })` call (next to
   `...fragmentsArg`). Import `loadReactionPreferences` and `MIN_REACTIONS` from
   `./load-reaction-preferences`. Prefer running the fragments load and the
   reaction load concurrently with `Promise.all` (independent queries).

2. **`stages/plotter.ts` → `runPlotter`**:
   - Add optional field to the options type: `reactionSummary?: ReactionSummary`.
   - Import `{ buildReactionPreferenceBlock, type ReactionSummary }` from
     `./reaction-preferences`.
   - Build the block next to the existing structure/lens blocks:
     ```ts
     const reactionBlock = options.reactionSummary
       ? buildReactionPreferenceBlock(options.reactionSummary)
       : ''
     ```
   - Append it in the `parts[0]` concatenation **after** `resolved.text` /
     `basePrompt` and alongside `structureBlock` — i.e. add `${reactionBlock}` to
     the existing template on line ~121. Code-appended position guarantees a DB
     prompt override can never drop it.

3. **No changes** to `runTextPhase` / `runWriter` (plotter-only, per §2).

### 5d. What implementation must NOT do

- Do not add DB access to `reaction-preferences.ts`.
- Do not thread reactions through the API trigger files or `loadUniverseContext`
  (that is the styleGuide path; the fragments/`universeId` path is used here).
- Do not emit style-guide-style abstractions in the block (that channel is #3).
- Do not touch the writer word budget.

---

## 6. Open questions

**None.** Aggregation scope (per-universe), module split, injection stage
(plotter-only), thresholds, and query shape are all resolved above with
codebase-anchored defaults.

---

## 7. Ordered implementation checklist

1. Create `stages/reaction-preferences.ts`: threshold constants, Zod `ReactionRow`
   + `ReactionSummary`, `summarizeReactions`, `buildReactionPreferenceBlock`
   (pure, DB-free, no comments).
2. Create `stages/reaction-preferences.test.ts` with the §4 cases; run
   `npx vitest run packages/core/src/pipeline/stages/reaction-preferences.test.ts`
   until green (no env vars needed — pure module).
3. Create `load-reaction-preferences.ts`: the §5a query + `summarizeReactions`
   call + `export *` re-export of the pure module.
4. Wire `runPlanPhase` and `runPlotterOnly` in `orchestrator.ts`: load the
   summary by `universeId` (concurrently with fragments), gate on `MIN_REACTIONS`,
   spread `reactionSummary` into `runPlotter`.
5. Extend `runPlotter` in `stages/plotter.ts`: accept `reactionSummary`, build the
   block, append it in `parts[0]` after `resolved.text` alongside `structureBlock`.
6. `npx tsc --noEmit` and the full `npx vitest run` — both clean.
7. Manual sanity: a universe with ≥3 reactions produces a plotter prompt
   containing the reaction block; a universe with 0 reactions produces the
   unchanged prompt.
```
