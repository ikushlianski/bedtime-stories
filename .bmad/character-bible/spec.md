# Per-Universe Character Bible — Implementation Spec

## 1. Business goal (scenarios)

The recurring "a character was inserted who can't be there" bug — a садик classmate showing up at a
family dinner, a baby narrating like a schoolkid, a character from another universe wandering in —
must be permanently closed. Today the plotter is only *softly* told to respect canon (the
character-lenses block ends with a prose "ГРАНИЦА" nudge), and the universe's cast is handed over as
a loose markdown bullet list folded into the universe context. Both are advisory and both can be
diluted or dropped by a DB prompt override.

After this feature:

- **Editor scenario.** In the universe editor, each character carries structured fields — age, the
  setting/group they belong to (e.g. their садик group), core traits, key relationships, and a
  co-occurrence note ("never in the same scene as the school kids"). A parent fills these in once per
  universe.
- **Generation scenario.** When a story is planned, the plotter is handed a strict cast sheet built
  from those fields and a hard rule: *use ONLY these characters unless the seed explicitly introduces
  a new one; respect every character's age and setting.* A character who does not fit can no longer be
  pulled into a scene "for variety."
- **Backward-compat scenario.** A universe that has not filled in any structured fields keeps working
  exactly as before — no strict block is emitted, and the existing soft canon boundary in the
  character-lenses block still applies.
- **Incidental-figures scenario.** The hard rule still allows un-named background figures (a passing
  bus driver, a nameless shopkeeper). It forbids *named, recurring* characters who aren't in the
  bible — that is the class of bug being closed.

## 2. Architecture

**Flow: DB → pure block → plotter (code-appended, non-overridable).**

```
universe_characters (structured rows)
        │
        ▼
loadUniverseContext(groupId)        packages/api/src/routes/load-universe-context.ts
   returns { ..., characters: CharacterBibleEntry[] }   ← NEW: raw structured array
   and STOPS folding the soft character list into universeContext
        │
        ▼
plan-phase orchestrator options      packages/core/src/pipeline/orchestrator.ts
   threads `bibleCharacters` parallel to `universeContext`
        │
        ▼
plotter.ts / plotter-series.ts
   import buildCharacterBibleBlock(bibleCharacters)   ← pure, DB-free
   append it as its own block, next to characterLensBlock
```

**Relation to the existing soft character-lenses boundary.** `character-lenses.ts` already appends a
*soft* prose boundary ("бери ТОЛЬКО тех персонажей, кто по канону и по месту действия реально может
здесь оказаться…"). The Character Bible is the **strict, data-driven upgrade** of that same idea: the
lens block keeps its general variety guidance, and the bible block adds the concrete roster plus the
hard "use ONLY these" gate. The lens boundary stays as the fallback for universes with no structured
cast (empty bible → empty block).

**Why code-appended matters.** Prompts are DB-overridable via `resolvePrompt()`. The cast currently
reaches the plotter *inside* `universeContext`, which is derived from DB-editable fields — an override
can weaken or drop it. Moving the roster + hard rule into a **code-generated block appended in
plotter.ts** (exactly the `characterLensBlock` / `structureBlock` pattern) makes the gate impossible
to drop from the DB side. This is the core architectural change, not just a UI addition.

**No double-listing.** `loadUniverseContext` presently folds a soft `## Персонажи вселенной` bullet
list into `universeContext` (`compileCharacters`, lines 11-19 and 31-33). If the strict bible block is
added *and* that fold stays, characters appear twice in the prompt. The fold is therefore removed:
`loadUniverseContext` returns the raw structured `characters` array instead, and the strict block
becomes the single source of the cast in the plotter prompt.

## 3. Data model changes — `universe_characters`

Existing columns (unchanged): `id`, `universe_id`, `name`, `description` (freeform, kept as the
catch-all fallback), `created_at`, `updated_at`.

**New columns — all nullable so every existing row survives untouched:**

| Column (TS) | DB column | Type | Nullable | Purpose |
|---|---|---|---|---|
| `age` | `age` | `text` | yes | Age as free text — must hold "5 лет", "грудничок", "младшая группа", not just an integer. |
| `setting` | `setting` | `text` | yes | The setting / group the character belongs to (e.g. садик group, дом, класс). |
| `traits` | `traits` | `text` | yes | Core traits, free text (comma-separated or prose). |
| `relationships` | `relationships` | `text` | yes | Key relationships, free text ("младший брат Гоши", "воспитательница"). |
| `coOccurrenceNote` | `co_occurrence_note` | `text` | yes | Who can / cannot realistically be in the same scene. Free text. |

All `text` (not integer) and all nullable. No new table, no NOT NULL, no default beyond DB null. This
is additive only — existing rows and the existing soft path keep functioning until fields are filled.

## 4. New files to create (the parallelizable part)

### 4a. `packages/core/src/pipeline/stages/character-bible-block.ts` (pure, DB-free, env-free)

- Export a Zod schema `CharacterBibleEntrySchema` and its inferred type `CharacterBibleEntry`:
  `{ name: string; age?: string | null; setting?: string | null; traits?: string | null;
  relationships?: string | null; coOccurrenceNote?: string | null; description?: string | null }`.
- Export `buildCharacterBibleUnstructured?` — not needed; single entry point below.
- Export `buildCharacterBibleBlock(characters: CharacterBibleEntry[]): string`:
  - **Returns `''` for an empty array** (backward-compat: empty roster → no block → the soft lens
    boundary remains the only gate; the plotter is never told "use ONLY: (nothing)").
  - Otherwise renders a `---`-delimited block (mirroring `buildCharacterLensBlock`'s shape) titled as
    the strict cast sheet ("БИБЛИЯ ПЕРСОНАЖЕЙ ВСЕЛЕННОЙ" or similar), listing each character with only
    the fields that are present (skip null/blank fields), followed by the **hard rule** text:
    - Use ONLY characters from this list; do not introduce new *named, recurring* characters unless the
      seed explicitly introduces one.
    - Respect each character's age and setting/group strictly — do not place a character where their
      age or setting makes them impossible.
    - Honour the co-occurrence notes.
    - Explicitly permit un-named incidental background figures (a passing bus driver, a nameless
      shopkeeper) so the gate is not over-aggressive.
- No imports from `db`, `process.env`, or any I/O. Pure string builder.

### 4b. `packages/core/src/pipeline/stages/character-bible-block.test.ts` (co-located vitest)

Cover at minimum:
- Empty array → returns `''`.
- Non-empty roster → block contains each character's name and each present structured field.
- Null/blank fields are omitted (no dangling "Возраст:" with empty value).
- The hard "use ONLY" rule text is present, and the incidental-figures allowance is present.

### 4c. `packages/web/src/components/character-bible-fields.tsx` (new UI child component)

- A small presentational component `CharacterBibleFields` taking the five new field values + their
  `onChange` setters (or a single value object + one `onChange`), rendering the extra labelled inputs
  (`FormField` + `input`/`textarea`, matching existing DaisyUI styling in `universe-characters.tsx`).
- Reused inside both the edit view of `CharacterCard` and `AddCharacterForm`.
- kebab-case filename, PascalCase component, no comments.

## 5. Wiring handoff (orchestrator-owned, serial)

These edits touch shared/threaded code and the schema; do them serially after 4a–4c land.

1. **Schema** — `packages/core/src/db/schema.ts` (`universeCharacters`, ~line 26): add the five
   nullable `text` columns from section 3.
2. **Migration** — generate via drizzle (`drizzle-kit generate`), then apply with
   `npm run db:migrate` from the repo root. Never hand-write the SQL; never `drizzle-kit migrate`
   (hangs on Neon). Columns are additive + nullable, so the migration is a pure `ADD COLUMN` set.
3. **`load-universe-context.ts`**:
   - Add `characters: CharacterBibleEntry[]` to the returned `UniverseContext` shape (map the DB rows
     to the Zod entry shape).
   - **Remove** the `compileCharacters` fold into `universeContext` (delete/stop calling it) so the
     cast is no longer duplicated in the soft context string. `universeContext` then carries only the
     `storyGroups.universeContext` prose.
4. **`orchestrator.ts`**: thread a `bibleCharacters?: CharacterBibleEntry[]` option through the
   **plan-phase** functions (`runPlanPhase`, `runPlotterOnly`, the plan portion of `runPipeline`, and
   the series plan path), parallel to how `universeContext` is threaded (the `...universeContextArg`
   spread pattern). Do **not** thread it into writer/critic paths — the plotter picks the cast; the
   writer follows the plan, so gating the plotter closes the bug class with no extra threading.
5. **`plotter.ts`**: `import { buildCharacterBibleBlock } from './character-bible-block'`; add
   `bibleCharacters?: CharacterBibleEntry[]` to the options; build
   `const characterBibleBlock = buildCharacterBibleBlock(options.bibleCharacters ?? [])` and append it
   in the `parts` join right next to `characterLensBlock`
   (`...${structureBlock}${characterLensBlock}${characterBibleBlock}${universeContextBlock}...`).
6. **`plotter-series.ts`**: same treatment — it independently assembles a prompt from `universeContext`
   and produces per-story outlines (it decides the cast for each item), so it must also receive
   `bibleCharacters` and append `buildCharacterBibleBlock(...)`. Without this, the series generation
   path keeps the bug class open *and* loses the character info that was removed from `universeContext`
   in step 3.
7. **API — `packages/api/src/routes/universes.ts`**: extend `createCharacterSchema` and
   `updateCharacterSchema` with the five new optional fields (`z.string().optional()` each), and pass
   them through in the `insert(...).values(...)` and `update(...).set(...)` calls. Update the `toPublic`
   / `GET /:id/characters` responses to include the new columns.
8. **Web API client — `packages/web/src/lib/api.ts`**: add the five fields to the `UniverseCharacter`
   interface and to the `createCharacter` / `updateCharacter` payload types.
9. **`universe-characters.tsx`**: wire `CharacterBibleFields` into `CharacterCard` (edit mode) and
   `AddCharacterForm`, holding the new fields in local state and including them in the
   `updateCharacter` / `createCharacter` calls. (Listed here because it edits the existing component;
   the new `character-bible-fields.tsx` child is the parallelizable part.)

## 6. Open questions

**None.** Resolved-with-defaults (noted for veto, not blocking):
- **Co-occurrence = free text** (`co_occurrence_note`), not structured pairs / join table — the plotter
  is an LLM that reads prose well, and a join table is unjustified complexity for a per-universe cast
  of a handful of characters.
- **age / traits / relationships = free text**, not int / array — must accommodate "грудничок",
  "младшая группа", prose relationships; the block only renders text to the model.

## 7. Ordered implementation checklist

1. Create `character-bible-block.ts` (Zod entry schema + `buildCharacterBibleBlock`, empty → `''`).
2. Create `character-bible-block.test.ts`; run `npx vitest run packages/core/src/pipeline/stages/character-bible-block.test.ts` green.
3. Create `character-bible-fields.tsx` child component.
4. Add the five nullable `text` columns to `universeCharacters` in `schema.ts`.
5. Generate the drizzle migration; apply with `npm run db:migrate`.
6. Update `load-universe-context.ts`: return `characters`, remove the soft `compileCharacters` fold.
7. Thread `bibleCharacters` through the plan-phase orchestrator functions.
8. Wire the block into `plotter.ts` (append next to `characterLensBlock`).
9. Wire the block into `plotter-series.ts` (same append).
10. Extend the API route schemas + persistence in `universes.ts`.
11. Extend `UniverseCharacter` type + character mutation payloads in `web/src/lib/api.ts`.
12. Wire `CharacterBibleFields` into `CharacterCard` and `AddCharacterForm` in `universe-characters.tsx`.
13. Run `npx tsc --noEmit` and the lint command repo-wide; fix to zero issues before finishing.
