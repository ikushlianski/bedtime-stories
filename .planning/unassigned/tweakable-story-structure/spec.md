---
type: spec
branch: tweakable-story-structure
task: Let a parent optionally pick the plot structure and character lens when creating a story, and make both Plotter and Writer respect the resolved choice (today only Plotter sees it)
complexity: medium
state: confirmed
updated: 2026-07-18
---
# Spec: Tweakable story structure + character lens

### Why

Every new story gets an automatically-rotated plot structure (`story-structures.ts`) and character
lens (`character-lenses.ts`), picked deterministically by `storyId % length`. There is no way to
override this manually, and — more importantly — only the Plotter stage ever receives the chosen
structure/lens (`plotter.ts` builds `structureBlock`/`characterLensBlock` into its own prompt only).
The Writer has zero awareness of which structure/lens the Plotter used, so the two stages can drift:
the Plotter may describe a "ПЕРЕВОРОТ" structure in the plan while the Writer, working purely from
plan text, has no explicit instruction reinforcing that pattern.

### Design decisions made autonomously

- **Stable `key` per structure/lens, English kebab-case, derived from the Russian title's meaning**
  (e.g. `snowball` for "СНЕЖНЫЙ КОМ", `gosha-errs` for "ГОША ОШИБАЕТСЯ"). Keys are referenced by API
  request, DB column, and `<select>` value — array position was never stable enough to persist.
- **Resolution happens independently inside each orchestrator function, by storyId — not threaded
  as a value between the plan phase and text phase.** The plan phase and text phase are genuinely
  separate executions in this codebase (an `approve-plan` gate sits between them; `redo-plan` and
  `redo-text` run at completely different times). There is no single call site where Plotter and
  Writer run together, so there is no value to "thread through" — resolving deterministically by
  storyId in each call is the only mechanism available, and it is safe because resolution is a pure
  function of `(stored structureKey/lensKey, storyId)`: same storyId always yields the same result,
  whether resolved during the plan phase or the text phase. This mirrors the existing
  `loadMemorableMoments(universeId, storyId)` precedent exactly — each orchestrator function already
  independently re-loads memorable moments by storyId rather than passing them across the
  plan/text boundary.
- **New core module `resolve-story-structure-choice.ts`**, alongside `load-memorable-moments.ts`:
  queries `stories.structureKey`/`stories.lensKey` by `storyId`, resolves via
  `getStoryStructureByKey`/`getCharacterLensByKey` when present, falling back to
  `selectStoryStructure(storyId)`/`selectCharacterLens(storyId)` (today's rotation) when the stored
  key is null OR unrecognized (defense-in-depth — Zod is the real gate at creation time, this
  fallback exists so a stale/bad value can never crash mid-pipeline).
- **Writer prompt reuses the exact same `buildStructureBlock`/`buildCharacterLensBlock` functions
  the Plotter already uses**, rather than a Writer-specific block. This is what makes "both prompts
  contain the same structure/lens text" true by construction, not just by coincidence — one shared
  block-builder, two call sites.
- **Web imports `STORY_STRUCTURES`/`CHARACTER_LENSES` directly from `@bedtime/core/pipeline/stages/*`**
  rather than duplicating the list in `@bedtime/shared`. Existing precedent: `model-picker.tsx`
  already imports `PIPELINE_STAGES`/`PIPELINE_STAGE_LABELS` directly from
  `@bedtime/core/pipeline/pipeline-stages`. Both source files are pure data with zero transitive
  imports (no db client), and the package's `exports` map (`"./*": "./src/*"`) resolves a subpath
  import to that exact file only — there is no barrel/index that would pull in unrelated code.
- **`runAnnotatedRewrite` (the editor-notes rewrite path used by `redo-text`) also resolves and
  passes structure/lens into the Writer**, even though it wasn't one of the three explicitly named
  call sites — it's still a Writer invocation, and leaving it out would mean an annotated rewrite
  silently drops the story's structure identity from the prompt.
- **Series creation (`stories-series.ts`, `runPlotterSeries`) is out of scope** — it's a distinct
  multi-variant plotting stage that doesn't go through `runPlanPhase`/`runPlotter`, and the task
  scoped this to the single-story `/new` creation flow.

### Files to create

```
packages/core/src/pipeline/resolve-story-structure-choice.ts       — DB-backed resolver, storyId -> {structure, lens}
packages/core/src/pipeline/resolve-story-structure-choice.test.ts  — mocked-db unit tests
packages/core/src/pipeline/stages/writer.test.ts                   — new: proves the writer prompt contains the resolved structure/lens
packages/core/src/db/migrations/0043_rare_changeling.sql           — additive: stories.structure_key, stories.lens_key (nullable text)
```

### Files modified

```
packages/core/src/pipeline/stages/story-structures.ts    — add `key` field + getStoryStructureByKey()
packages/core/src/pipeline/stages/character-lenses.ts     — add `key` field + getCharacterLensByKey()
packages/core/src/pipeline/stages/plotter.ts              — runPlotter() accepts structure?/characterLens?, falls back to today's selection
packages/core/src/pipeline/stages/writer.ts               — runWriter() gains structure?/characterLens? + builds the same blocks into its prompt (the actual fix)
packages/core/src/pipeline/orchestrator.ts                — runPlanPhase/runTextPhase/runPlotterOnly/runWriterOnly/runAnnotatedRewrite all resolve via resolveStoryStructureChoice(storyId) and pass into the Plotter/Writer call
packages/core/src/pipeline/orchestrator.test.ts            — propagation coverage: same storyId -> same structure/lens for both runPlotter and runWriter
packages/core/src/db/schema.ts                             — stories.structureKey, stories.lensKey (nullable text columns)
packages/api/src/routes/create-story-schema.ts             — structureKey?/lensKey? Zod fields, refine-validated against known keys, forwarded through resolveCreateStoryMode
packages/api/src/routes/create-story-schema.test.ts        — schema + resolver coverage for valid/unknown keys
packages/api/src/routes/stories.ts                          — POST / persists structureKey/lensKey when present; toSnakeCase exposes structure_key/lens_key
packages/web/src/lib/api.ts                                 — CreateStoryInput + Story gain structureKey/lensKey (request) and structure_key/lens_key (response)
packages/web/src/components/create-story-form.ts            — CreateStoryFormState gains structureKey/lensKey (null = Auto), validated through into the request only when set
packages/web/src/components/create-story-form.test.ts       — coverage for Auto (omitted) vs explicit choice
packages/web/src/components/create-story-modal.tsx          — two new native <select> controls (Plot structure / Character lens), defaulting to "Auto"
```

### Data model changes

`stories` gains two nullable `text` columns: `structure_key`, `lens_key`. Purely additive — no
backfill, no existing row affected, no default (`null` = today's rotation behavior unchanged).

### Redo/regenerate behavior

`redo-plan` (`pipeline-plan-redo.ts` → `runPlotterOnly`), `redo-text` (`pipeline-text-rewrite.ts` →
`runAnnotatedRewrite`), and the annotated full-redo path (`pipeline-text-redo.ts` → `runPlanPhase` +
`runTextPhase`) all resolve structure/lens the same way, by storyId, inside the orchestrator layer —
they never re-roll independently. Confirmed: `selectStoryStructure(storyId)`/
`selectCharacterLens(storyId)` are pure functions of storyId, so even for a story that got no
explicit choice at creation (stored keys stay null), rotation-by-storyId returns the exact same
structure/lens on every redo, because storyId never changes for a given story. A story that DID get
an explicit choice persists it in `stories.structure_key`/`lens_key` and every redo reads that same
stored value.

### Definition of Done — per layer

**Backend:** `POST /api/stories` with `{ seed, groupId, structureKey: "snowball", lensKey: "gosha-errs" }`
returns `201` with `structure_key: "snowball"`, `lens_key: "gosha-errs"` in the response body and
row. `POST /api/stories` with `{ seed, groupId, structureKey: "not-a-real-key" }` returns `400` with
`{ "error": "Unknown structureKey" }`. `npx vitest run` passes in full, including new coverage in
`resolve-story-structure-choice.test.ts`, `writer.test.ts`, `orchestrator.test.ts` (structure/lens
propagation describe block), and `create-story-schema.test.ts`.

**Frontend:** The create-story modal shows two additional selects — "Структура сюжета" and "Ракурс
на персонажей" — each defaulting to "Авто" and listing all 10 structures / 8 lenses by name. Leaving
both on Auto submits a request with no `structureKey`/`lensKey` fields (today's behavior, unchanged).
Picking a specific value submits that key. `npx tsc --noEmit` clean in `packages/web`.

**Infrastructure/DB:** Migration `0043_rare_changeling.sql` (`ALTER TABLE stories ADD COLUMN
structure_key text` / `ADD COLUMN lens_key text`) applied via `npm run db:migrate` against the dev
Neon branch — purely additive, zero downtime, no existing data affected.

### Scope boundary

Out of scope: `stories-series.ts` (multi-variant series creation) — untouched, still uses today's
rotation only. No UI to preview a structure/lens's full description/guidance text beyond the
`<option title>` tooltip. No change to `story-settings.ts` (the "setting" rotation), which the task
did not mention.
