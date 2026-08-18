---
type: spec
branch: main
task: Optional reference-story input on story creation — pass a specific existing story's text into Plotter/Writer
complexity: medium
state: confirmed
updated: 2026-08-18
---
# Spec: Reference story input on story creation

### Why

The "new story" form lets a user optionally paste an existing story's ID or URL
(`https://bedtime-agent.ilya.online/stories/127`). That story's finalized text is loaded and passed
to the Plotter and Writer as a distinct, clearly-labeled block — separate from the random
per-universe `exemplars` mechanism (`load-exemplars.ts`), which is for tone, not a specific
user-chosen story. Single-story creation + redo/rewrite paths only; `stories-series.ts` batch mode
stays out of scope (same documented single-universe-only boundary already applies there).

No open questions remain below — every fork found during research is resolved inline with the
conventional choice for this codebase.

### Resolved ambiguity: existence vs. finalized-text check

Decision #3 (route validates existence) and decision #5 (`loadReferenceStory` only returns
non-null when `textFinal` is set) look like they could disagree. Resolution: the create route
rejects with 400 unless the referenced story exists **and** has non-null `textFinal` (one query,
one clear error message: "Referenced story has no finalized text"). `loadReferenceStory` keeps its
own null-guard anyway as defense-in-depth, since the referenced row's `textFinal` could be cleared
or the row `SET NULL`'d after creation.

### Correction to task brief: exemplars are NOT loaded in the orchestrator

`loadRandomExemplars` is called from `packages/api/src/routes/pipeline-text-trigger.ts:70`, not
from `orchestrator.ts` — the orchestrator only accepts `exemplars?: Exemplar[]` as a param (lines
219, 413). This feature intentionally does **not** copy that pattern: `loadReferenceStory` is
called *inside* `orchestrator.ts` itself, keyed off `options.storyId` (same style as the existing
`loadMemorableMoments(universeIds, storyId)` / `loadRecentTitles` calls already in that file).
Consequence: **no changes needed** in `pipeline-plan-trigger.ts`, `pipeline-text-trigger.ts`,
`pipeline-plan-redo.ts`, `pipeline-text-redo.ts`, `pipeline-text-rewrite.ts`, or
`stories-swap-model.ts` — they all call `runPlanPhase`/`runPlotterOnly`/`runTextPhase`/
`runWriterOnly` with a `storyId`, so all five redo/rewrite/swap-model paths inherit the reference
story automatically with zero extra wiring.

### Data model changes

```
packages/core/src/db/schema.ts (stories table, ~line 59-97)
  + referenceStoryId: integer('reference_story_id')
      .references((): AnyPgColumn => stories.id, { onDelete: 'set null' })
  (import AnyPgColumn from 'drizzle-orm/pg-core'; self-referencing FK needs the explicit
  return-type annotation to break circular type inference — unlike universeSuggestions.sourceStoryId,
  which is a forward cross-table reference and not precedent for a same-table self-FK. If
  `npx tsc --noEmit` complains about this line, the AnyPgColumn annotation is the fix.)

packages/core/src/db/migrations/
  Generate with: npx drizzle-kit generate (root drizzle.config.ts already points schema/out
  correctly; there is NO npm db:generate script, run drizzle-kit directly). Do not hand-author.
  Next file will be 0050_<generated-name>.sql (last is 0049_large_meggan.sql). Expected SQL:
    ALTER TABLE "stories" ADD COLUMN "reference_story_id" integer;
    ALTER TABLE "stories" ADD CONSTRAINT "stories_reference_story_id_stories_id_fk"
      FOREIGN KEY ("reference_story_id") REFERENCES "public"."stories"("id") ON DELETE set null ...
  meta/_journal.json + meta/0050_snapshot.json regenerate automatically.
  Apply with: npm run db:migrate (NEVER drizzle-kit migrate directly — hangs on Neon, per CLAUDE.md)
```

### Files to modify

```
packages/core/src/db/schema.ts
  + referenceStoryId column (see above)

packages/core/src/pipeline/load-reference-story.ts   [NEW]
  export interface ReferenceStory { title: string; textFinal: string }
  export async function loadReferenceStory(storyId: number): Promise<ReferenceStory | null>
    — select referenceStoryId from stories where id = storyId
    — if null, return null
    — else select { title, textFinal } from stories where id = referenceStoryId
    — return null unless textFinal is non-null (mirror load-exemplars.ts's toExemplar null-guard
      pattern), else { title, textFinal }

packages/core/src/pipeline/orchestrator.ts
  runPlanPhase / runPlotterOnly: add loadReferenceStory(options.storyId) into the existing
    Promise.all alongside loadMemorableMoments/resolveStoryStructureChoice; if non-null, pass
    referenceStory into runPlotter({ ...referenceStory ? { referenceStory } : {} })
  runTextPhase / runWriterOnly: same, into runWriter(...)
  (do NOT thread it through as a caller-supplied option like `exemplars` — load it internally
  from storyId so every regenerate path inherits it for free)

packages/core/src/pipeline/stages/plotter.ts
  runPlotter options: + referenceStory?: { title: string; textFinal: string }
  + referenceStoryBlock, built same style as sashaContextBlock/universeContextBlock:
    "\n\n---\nИСТОРИЯ-ССЫЛКА (пользователь явно попросил учитывать её при создании этой истории —
    не копируй персонажей из неё автоматически, если они не относятся к текущей вселенной, но
    учти её сюжет/тему/тон/события как контекст):\n[«{title}»]\n{textFinal}\n---\n"
    (implementer's call on exact Russian wording; intent is fixed: distinct from exemplars,
    explicitly user-requested, don't auto-import characters from a different universe)
  spliced into `parts` alongside the other context blocks
  console.log(`[PLOTTER] using reference story «${title}»`) when present — mirrors the existing
    `[WRITER] using N canonical exemplar(s)` log at pipeline-text-trigger.ts:79-81, so a manual
    smoke test is directly observable in logs

packages/core/src/pipeline/stages/writer.ts
  same shape: runWriter options + referenceStory?: {...}, block built and spliced next to (but
  visually distinct from) exemplarsBlock — NOT merged into the exemplars list/loop
  console.log(`[WRITER] using reference story «${title}»`) when present

packages/api/src/routes/create-story-schema.ts
  createStorySchema: + referenceStoryId: z.number().int().positive().optional()
  CreateStoryMode 'agent' variant: + referenceStoryId?: number
  resolveCreateStoryMode (agent branch only, ~line 105-140): thread it through —
    if (input.referenceStoryId !== undefined) result.referenceStoryId = input.referenceStoryId
  (legacy/user textFinal branches ignore it — no pipeline runs there, nothing to attach it to)

packages/api/src/routes/stories.ts
  router.post('/') agent-mode branch (~line 128-139): before building `newStory`, if
    resolved.referenceStoryId is set, look up that story
    (db.select({ id, textFinal }).from(stories).where(eq(stories.id, resolved.referenceStoryId))):
    - not found → 400 { error: 'Referenced story not found' }
    - found but textFinal is null → 400 { error: 'Referenced story has no finalized text' }
    - else newStory gains referenceStoryId: resolved.referenceStoryId
  toSnakeCase(row) (~line 38-77): + reference_story_id: row.referenceStoryId ?? null
    (mirrors every other column already exposed here — needed for the story-reader stretch goal
    and general API completeness; cheap, do unconditionally)

packages/web/src/lib/api.ts
  CreateStoryInput agent variant (~line 367-377): + referenceStoryId?: number
  Story type: + reference_story_id: number | null

packages/web/src/components/create-story-form.ts
  + export function parseReferenceStoryId(raw: string): number | null
      — trim; if empty return null
      — if matches /^\d+$/ return parseInt
      — else extract trailing /stories/(\d+) via regex from a pasted URL, return parsed id or null
        if no match (client-side only, no backend fetch — existence is checked server-side)
  CreateStoryFormState: + referenceStoryRaw: string  (raw text field, not the parsed id)
  INITIAL_CREATE_STORY_FORM: + referenceStoryRaw: ''
  validateCreateStoryForm:
    - if referenceStoryRaw is non-empty and parseReferenceStoryId returns null →
      { valid: false, reason: 'Enter a valid story ID or URL' }
    - else include referenceStoryId in the returned `input` only when parsed value is non-null
      (same `...(cond ? {...} : {})` spread pattern already used for structureKey/lensKey)

packages/web/src/components/create-story-form.test.ts
  + tests for parseReferenceStoryId (raw digits, full URL, trailing slash/query noise, empty →
    null, garbage → null) and for validateCreateStoryForm's new reject/accept cases, following
    the existing formWith(...) helper pattern in this file

packages/web/src/components/create-story-modal.tsx
  + one new text input near the seed textarea (~line 392-398), label
    "Ссылка на историю или её ID (необязательно)", bound to form.referenceStoryRaw
  setForm(...) form-state resets at BOTH line ~195 (handleSubmit success) and ~259
    (createSeries success) must include referenceStoryRaw: '' — both currently use literal
    object resets that would otherwise leak the field across submits
```

### Nice-to-have (not required for done)

`packages/web/src/pages/story-reader.tsx`: show "На основе истории: <title>" near the title when
`story.reference_story_id` is set (would need a lookup or a joined title in the story-fetch
response — implementer's call whether to add this round trip). Stretch only, skip if time-boxed.

### Implementation order

1. Schema + migration (`npx drizzle-kit generate`, review SQL is additive-only, `npm run db:migrate`).
2. `load-reference-story.ts` (new loader, unit-testable in isolation).
3. `plotter.ts` / `writer.ts`: accept + render `referenceStory` block.
4. `orchestrator.ts`: wire `loadReferenceStory(storyId)` into all four phase functions.
5. API: schema + `resolveCreateStoryMode` + `stories.ts` create-route validation + `toSnakeCase`.
6. Web: `api.ts` types, `create-story-form.ts` (+ tests), `create-story-modal.tsx` input + reset fix.

### Done-when checklist

- [ ] `reference_story_id` column exists on `stories` in the schema and migration 0050 is applied
      to prod via `npm run db:migrate` (never `drizzle-kit migrate` directly).
- [ ] Creating a story with a valid `referenceStoryId` (raw int or pasted URL) succeeds; an
      invalid/nonexistent one returns 400 with a clear error; a story with null `textFinal` as the
      target returns 400.
- [ ] Plotter and Writer prompts contain a distinct "ИСТОРИЯ-ССЫЛКА" block only when set, never
      merged into the exemplars block.
- [ ] Redo-plan, redo-text, rewrite, and swap-model on a story created with a referenceStoryId
      still include the reference story in the regenerated prompt, with zero changes to their own
      trigger files (verifies the orchestrator-level wiring works end-to-end).
- [ ] Existing tests pass: `npx vitest run` (both packages/core and packages/api and packages/web),
      `npx tsc --noEmit` clean across workspaces.
- [ ] Manual smoke test: create a story pasting an existing story's URL; tail logs for
      `[PLOTTER] using reference story «...»` and `[WRITER] using reference story «...»`; confirm
      the generated story's tone/topic plausibly riffs on the referenced one.

### Scope boundary

Out of scope: `stories-series.ts` batch/series generation (existing single-universe-only precedent
extends here — no reference-story support in batch mode). Any UI display of the reference on the
reader page is optional/stretch, not blocking.
