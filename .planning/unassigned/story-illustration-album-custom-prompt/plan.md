# Plan: Custom-prompt on-demand illustrations

## Summary

Add one new admin-only capability on top of the existing story-illustration-album system: an admin viewing a story's reading page can type a free-text image-generation prompt and a count (default 2, max 6), and get exactly that many images generated from that exact prompt — not from automatically-selected story moments, not assembled/rewritten via `buildIllustrationPrompt`. The images are stored as new rows in the existing `storyIllustrations` table with a new `source: 'custom'` value, are purely additive (never deleted by the existing "regenerate album" action), and render in the same gallery/lightbox the automatic/manual album already uses. Every existing scenario (automatic generation on the four ready-transition paths, manual markers, force-regenerate) is verified unaffected.

This requires exactly three small, surgical, behavior-preserving edits to `generate-illustration-album.ts` (detailed below) — everything else is new, additive code in new files.

## Decisions

1. **Prompt handling: fully verbatim, zero assembly, zero reference images.** The custom prompt is passed to `aiRunner.generateImage` byte-for-byte as `prompt`, with `referenceImageUrls: []`. Rejected alternative: attaching the shared default style-anchor image without any accompanying "this image is style-only" instruction sentence — both `build-illustration-prompt.ts` and `generate-portrait.ts` treat that instruction as load-bearing (an anchor image attached silently risks the model pulling its subject into the picture, an untested third behavior). Appending one style-anchor sentence to an otherwise-verbatim prompt was considered and rejected too, because it stops being "that exact prompt" the moment any text is appended, contradicting the explicit ask. **Tradeoff, stated explicitly**: a custom-prompt image gets no character-identity conditioning (no portraits attached even if the prompt names an existing character) and does not automatically match the picture-book house style the way every automatic/manual illustration does. This is the accepted cost of "exact prompt, exact count."

2. **Storage: same `storyIllustrations` table, new `source: 'custom'` value.** `source` is a plain `text()` Drizzle column with no CHECK constraint (verified against the actual migration SQL) — widening its TypeScript union from `'automatic' | 'manual'` to `'automatic' | 'manual' | 'custom'` in `schema.ts` requires **no SQL migration at all**. This is the minimal possible schema change, and it reuses `generate-illustration-album.ts`'s existing storage/upload machinery (`buildStoryIllustrationAssetPath`, `aiRunner.generateImage`, `mediaTypeToExtension`) via a new sibling orchestration file rather than duplicating a table.

3. **`orderIndex`: reserved base of 1000, custom generation is additive and never replaces prior rows.** Every custom-generation call appends new rows; it never deletes existing custom rows (unlike "regenerate album," which replaces automatic+manual outright). New rows get `orderIndex = 1000 + currentCustomRowCountForStory + i`. This guarantees no collision with automatic/manual `orderIndex` values (0..5, bounded by `TARGET_COUNT`=2 and the marker cap of 6) regardless of future changes to either cap, and — combined with the GET route's existing `orderBy(asc(orderIndex))` — custom images always sort after the automatic/manual album in the gallery. This is intentional, not accidental: state it in code comments only if genuinely non-obvious (it likely needs one line, since the "why 1000" reasoning isn't derivable from the number alone).

4. **"Regenerate album" must not touch custom rows — this requires patching `generate-illustration-album.ts` in exactly three places**, all mechanical `where` predicate widenings, no logic change:
   - The idempotency/skip-if-exists check (existing lines ~55-63): `existingRows` must exclude `source: 'custom'`. **This is the one non-obvious, easy-to-miss fix**: without it, an admin who generates custom images on a story whose automatic album is still empty (a real, already-supported state — the gallery's own `EMPTY_ALBUM_RETRY_DELAY_MS` retry exists because automatic albums can legitimately end up empty) permanently suppresses that story's automatic album forever after, because every later ready-transition call to `generateIllustrationAlbum(storyId, storage)` (no `force`) would find the custom rows, treat the album as "already exists," and return early without ever running automatic/manual generation.
   - The empty-combined-moments delete (existing line ~113, inside `if (combinedMoments.length === 0)`): exclude `source: 'custom'`.
   - The force-regenerate delete (existing line ~215): exclude `source: 'custom'`.

   Concretely: add `and, ne` to the existing `import { asc, eq } from 'drizzle-orm'` line, and change each of the three `.where(eq(storyIllustrations.storyId, storyId))` calls to `.where(and(eq(storyIllustrations.storyId, storyId), ne(storyIllustrations.source, 'custom')))`. This is a boundary fix for the new feature's additive guarantee, not a change to automatic-generation logic or `TARGET_COUNT` — with no custom rows present (every existing scenario, and every existing test), `ne(source, 'custom')` is always true and behavior is byte-for-byte identical to today.

   **Test-mock caveat for the implementer**: `generate-illustration-album.test.ts` mocks `db.select().where()` and `db.delete().where()` with shallow builders that record the `where` argument but never actually filter by it (`where: () => builder` for select; `where: vi.fn(async (cond) => { deleteCalls.push(cond) })` for delete). This means the three-site patch will not break any existing test (they don't inspect predicate semantics), but it also means a naive new test asserting "custom rows survive regenerate" **cannot be verified through this mock as currently written**, because the mock ignores the predicate entirely. To actually test the filter, partially mock `drizzle-orm` (`vi.importActual` for `eq`/`asc`, `vi.fn` wrapping `and`/`ne`) and assert `ne` was called with `(storyIllustrations.source, 'custom')` at each of the three call sites — or, more simply, assert the recorded `cond` passed to `where()` is an object produced by `and(...)` (drizzle's `and()`/`ne()` return distinguishable SQL AST nodes you can snapshot-compare). Document this explicitly so the implementer doesn't waste a cycle discovering the mock's shallowness.

5. **Dispatch: synchronous, matching `POST /:id/illustrations/regenerate` exactly — no new dispatch/polling infrastructure.** `POST /:id/illustrations/regenerate` is already synchronous and already fans out up to 6 parallel `aiRunner.generateImage` calls in one HTTP request whenever a story has 6 markers (the existing manual-marker cap) — this is proven-shipped behavior in this exact codebase. Capping custom generation at the same 6 keeps it inside that already-accepted latency/parallelism envelope, so no new Cloud-Tasks dispatch, no polling, no `dispatch-then-refresh` pattern is needed. `packages/web/src/lib/api.ts`'s `request()` helper has no client-side timeout/`AbortController` (verified), so a 6-image synchronous fan-out cannot hit a frontend timeout either. This intentionally does **not** follow the `dispatchIllustrationAlbum` async pattern, because that pattern exists for *system-triggered* generation on story-ready transitions, not for an *admin-initiated, on-demand, already-synchronous-by-precedent* action like this one.

6. **Count cap: 1–6, default 2.** Matches the existing manual-marker cap (`validate-marker-limit.ts`'s cap of 6) exactly — same order-of-magnitude cost reasoning already accepted in this codebase (6 × ~$0.039 ≈ $0.23 per burst), and it's the same number that already makes the synchronous-dispatch decision above safe (see Decision 5). No new cap value to separately justify.

7. **`stage` value: new `'story_illustration_custom'`, not reused `'story_illustration'`.** Verified no code in this repo hardcodes/enumerates the set of `stage` strings for cost-breakdown display or aggregation (grep for `stage ===` and for the string `'character_portrait'` across non-test files turned up no such allowlist) — cost breakdowns key dynamically off whatever `stage` string appears in `model_calls`. A distinct stage value keeps custom-prompt spend auditable separately from automatic/manual album spend, which matters because this is a repeatable, admin-triggered, potentially-frequent paid action distinct from the once-per-story automatic album.

8. **UI: extend the existing `StoryIllustrationGallery` component, not a new sibling.** The component is 147 lines today; adding a collapsible "custom generation" block (textarea, number input, button, confirm dialog, inline error) is well within the repo's ~300-line file guideline and keeps all illustration-gallery UI in one place, matching how `regenerate` already lives here rather than in a separate component.

9. **Story-not-found and empty-array conventions mirror `generateIllustrationAlbum` exactly, with an explicit frontend message for the ambiguous case.** `generateIllustrationAlbum` silently returns `[]` if the story has no usable text (no throw, no special status code) — `generateCustomIllustrations` mirrors this: if the story doesn't exist, return `[]`; the route responds `201` with `[]`, same as today's `regenerate` route would for a similarly-degenerate case. Because an empty or short array is ambiguous to an admin (story-not-found vs. every image call failed vs. partial failure), the frontend plan below requires an explicit inline message whenever the returned array's length is less than the requested count — the backend does not distinguish these cases, but the UI must not silently show nothing.

## Data model changes

**No SQL migration required.** `story_illustrations.source` is a plain `text()` column with no CHECK constraint (confirmed by reading the actual migration SQL, not just `schema.ts`). The only change is a TypeScript type widening:

`packages/core/src/db/schema.ts` (~line 439):
```ts
// before
source: text('source').$type<'automatic' | 'manual'>().notNull(),
// after
source: text('source').$type<'automatic' | 'manual' | 'custom'>().notNull(),
```

`StoryIllustration`/`NewStoryIllustration` in `packages/core/src/db/types.ts` need no manual edit — both are `typeof storyIllustrations.$inferSelect`/`$inferInsert` and pick up the widened union automatically.

**Acceptance step, not a code change**: run `npx drizzle-kit generate` from the repo root after the schema edit and confirm it produces **no new migration file** (empty diff) — this is the concrete way to verify the "no migration needed" claim rather than assuming it. If it unexpectedly generates a diff, stop and re-investigate before proceeding (something about the column was misread).

No changes needed to `story_illustration_markers`, `model_calls`, or any other table.

## API contract

New route in `packages/api/src/routes/story-illustrations.ts` (same file, alongside existing `GET /:id/illustrations` and `POST /:id/illustrations/regenerate`):

```
POST /api/stories/:id/illustrations/custom
```

Request body (validated via the existing `validate` middleware, mirroring `story-illustration-markers.ts`'s pattern exactly):

```ts
const customIllustrationsSchema = z.object({
  prompt: z.string().trim().min(1, 'Промпт не может быть пустым').max(4000, 'Слишком длинный промпт (максимум 4000 символов)'),
  count: z.number().int().min(1).max(6).default(2),
})
```

- `prompt` — required, 1–4000 chars. (4000 chosen deliberately larger than the 2000-char annotation/marker cap, since this is a hand-typed generation instruction that may describe multiple details, not a bounded story excerpt — no existing precedent for a "generation prompt" length cap in this codebase, so this is a fresh, generous-but-bounded judgment call, flagged as such.)
- `count` — optional, defaults to 2 via Zod's `.default(2)` (applies when the key is omitted; validates 1–6 when provided). A value of 0, negative, non-integer, or >6 is rejected with a 400 and the Zod-provided message.

Success response — `201`, body is an array of **only the newly created rows** (not the whole album; the frontend appends these to its existing in-memory list), same shape `toApiShape` already produces:

```ts
Array<{
  id: number
  imageUrl: string          // buildPublicObjectUrl, same as existing rows
  momentDescription: string // the prompt, verbatim
  source: 'custom'
  orderIndex: number        // >= 1000
}>
```

If the story doesn't exist, or every image call fails: responds `201` with `[]` (mirrors `generateIllustrationAlbum`'s established silent-empty convention; see Decision 9). Only a validation failure produces `400`; only an unexpected exception produces `500` (matching the try/catch pattern already used by the two sibling routes in this file).

Invalid `id` param: `400 { error: 'Invalid story id' }`, same as the two existing routes (reuse the existing `parseIntParam` helper already in this file).

## Backend implementation plan

### New file: `packages/core/src/story-illustrations/generate-custom-illustrations.ts`

```ts
import { randomUUID } from 'node:crypto'
import { and, count as sqlCount, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { stories, storyIllustrations } from '../db/schema.js'
import type { StoryIllustration } from '../db/types.js'
import { aiRunner } from '../ai/index.js'
import type { ObjectStorage } from '../storage/object-storage.interface.js'
import { ILLUSTRATION_MODEL } from './generate-illustration-album.js'
import { buildStoryIllustrationAssetPath } from './build-story-illustration-asset-path.js'

export const CUSTOM_ILLUSTRATION_ORDER_INDEX_BASE = 1000
export const MAX_CUSTOM_ILLUSTRATION_COUNT = 6
export const DEFAULT_CUSTOM_ILLUSTRATION_COUNT = 2

export interface GenerateCustomIllustrationsInput {
  storyId: number
  prompt: string
  count: number
}

function mediaTypeToExtension(mediaType: string): string {
  if (mediaType.includes('jpeg')) return 'jpg'
  if (mediaType.includes('webp')) return 'webp'
  return 'png'
}

export async function generateCustomIllustrations(
  input: GenerateCustomIllustrationsInput,
  storage: ObjectStorage,
): Promise<StoryIllustration[]> {
  const [story] = await db.select({ id: stories.id }).from(stories).where(eq(stories.id, input.storyId))
  if (!story) return []

  const settled = await Promise.allSettled(
    Array.from({ length: input.count }, () =>
      aiRunner.generateImage({
        model: ILLUSTRATION_MODEL,
        prompt: input.prompt,
        referenceImageUrls: [],
        storyId: input.storyId,
        stage: 'story_illustration_custom',
      }),
    ),
  )

  const uploaded: { storagePath: string }[] = []

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!
    if (result.status !== 'fulfilled') {
      console.error(`[custom-illustration] story ${input.storyId} — generation failed for image ${i}:`, result.reason)
      continue
    }
    try {
      const extension = mediaTypeToExtension(result.value.mediaType)
      const storagePath = buildStoryIllustrationAssetPath({ storyId: input.storyId, fileId: randomUUID(), extension })
      await storage.upload({ path: storagePath, data: Buffer.from(result.value.imageBase64, 'base64'), contentType: result.value.mediaType })
      uploaded.push({ storagePath })
    } catch (err) {
      console.error(`[custom-illustration] story ${input.storyId} — upload failed for image ${i}:`, err)
    }
  }

  if (uploaded.length === 0) return []

  const [{ existingCustomCount }] = await db
    .select({ existingCustomCount: sqlCount() })
    .from(storyIllustrations)
    .where(and(eq(storyIllustrations.storyId, input.storyId), eq(storyIllustrations.source, 'custom')))

  return db
    .insert(storyIllustrations)
    .values(
      uploaded.map((u, i) => ({
        storyId: input.storyId,
        storagePath: u.storagePath,
        momentDescription: input.prompt,
        source: 'custom' as const,
        characterIds: null,
        orderIndex: CUSTOM_ILLUSTRATION_ORDER_INDEX_BASE + existingCustomCount + i,
      })),
    )
    .returning()
}
```

Notes for the implementer:
- `ILLUSTRATION_MODEL` is imported from the sibling `generate-illustration-album.ts` (same feature domain, not a cross-domain duplication) — this is fine and preferred over duplicating the constant.
- `mediaTypeToExtension` is duplicated (3 lines) rather than extracted/exported, consistent with this codebase's own precedent of accepting small duplication to keep files independently reviewable. Do not refactor `generate-illustration-album.ts` to export this helper; that's an unnecessary touch to a file this task requires to stay behavior-identical apart from the three sanctioned filter changes.
- No character/cast loading, no `buildIllustrationPrompt`, no `loadDefaultStyleImageDataUri` — this function has none of the moment-selection or identity-reference machinery, by design (Decision 1).
- `sqlCount` is `drizzle-orm`'s aggregate `count` import, renamed locally to avoid colliding with the `count` field name in `GenerateCustomIllustrationsInput`.

### Modify: `packages/core/src/story-illustrations/generate-illustration-album.ts`

Exactly three changes, all mechanical:

1. Import line: `import { asc, eq } from 'drizzle-orm'` → `import { and, asc, eq, ne } from 'drizzle-orm'`
2. Idempotency check (~line 56-60):
   ```ts
   const existingRows = await db
     .select()
     .from(storyIllustrations)
     .where(and(eq(storyIllustrations.storyId, storyId), ne(storyIllustrations.source, 'custom')))
     .orderBy(asc(storyIllustrations.orderIndex))
   ```
3. Empty-moments delete (~line 113): `await db.delete(storyIllustrations).where(and(eq(storyIllustrations.storyId, storyId), ne(storyIllustrations.source, 'custom')))`
4. Force-regenerate delete (~line 215): same change as #3.

No other line in this file changes. `TARGET_COUNT`, the four external dispatch call sites, `buildIllustrationPrompt` usage, and every other line remain byte-for-byte identical.

### Modify: `packages/api/src/routes/story-illustrations.ts`

Add import: `import { generateCustomIllustrations, DEFAULT_CUSTOM_ILLUSTRATION_COUNT, MAX_CUSTOM_ILLUSTRATION_COUNT } from '@bedtime/core/story-illustrations/generate-custom-illustrations'`, `import { z } from 'zod'`, `import { validate } from '../middleware/validate'`.

Add the schema (see API contract) and route:

```ts
router.post('/:id/illustrations/custom', validate(customIllustrationsSchema), async (req, res) => {
  try {
    const storyId = parseIntParam(req.params['id'])
    if (isNaN(storyId)) {
      res.status(400).json({ error: 'Invalid story id' })
      return
    }
    const { prompt, count } = req.body as z.infer<typeof customIllustrationsSchema>
    const rows = await generateCustomIllustrations({ storyId, prompt, count }, objectStorage)
    res.status(201).json(rows.map(toApiShape))
  } catch (err) {
    console.error('POST /stories/:id/illustrations/custom failed:', err)
    res.status(500).json({ error: 'Failed to generate custom illustrations' })
  }
})
```

Use `MAX_CUSTOM_ILLUSTRATION_COUNT`/`DEFAULT_CUSTOM_ILLUSTRATION_COUNT` as the literal `6`/`2` in the Zod schema (import the constants rather than hardcoding the numbers twice, to keep the cap defined once).

No changes needed to `packages/api/src/server.ts` (route lives in an already-mounted router file), `story-illustration-trigger.ts`, `pipeline-dispatch.ts`, or `internal-worker.ts` — this is a purely synchronous, admin-request-scoped route (Decision 5).

### New test file: `packages/core/src/story-illustrations/generate-custom-illustrations.test.ts`

Mirror the mocking pattern already used in `generate-illustration-album.test.ts` (mock `../db/client.js`, `../ai/index.js`; do not mock `../pipeline/*` or `./load-story-cast.js` — this function never touches them). Cover:
- Story not found → returns `[]`, `aiRunner.generateImage` never called.
- Default count (test the function itself with `count: 2`) → exactly 2 `generateImage` calls, each with `prompt` equal to the input verbatim and `referenceImageUrls: []`.
- Custom count (e.g. 4) → exactly 4 calls, 4 rows inserted with `orderIndex` `1000, 1001, 1002, 1003` when no prior custom rows exist.
- Partial failure (2 of 3 succeed) → returns 2 rows, no throw.
- `orderIndex` continuation: when the mocked select for `existingCustomCount` returns e.g. `2`, newly inserted rows get `orderIndex` starting at `1002`.
- Every inserted row has `source: 'custom'` and `characterIds: null`.

### New/extended test file: `packages/api/src/routes/story-illustrations.test.ts`

Add cases for `POST /:id/illustrations/custom` mirroring the existing `regenerate` test's structure (mock `generateCustomIllustrations`, assert it's called with `{ storyId, prompt, count }`, assert response shape/status). Add a validation-rejection case (`count: 7` → `400` before `generateCustomIllustrations` is ever invoked, since `validate` short-circuits).

### Modify (test-only): `packages/core/src/story-illustrations/generate-illustration-album.test.ts`

Add regression coverage for the three-site patch per Decision 4's test-mock caveat: partially mock `drizzle-orm` so `and`/`ne` are spies wrapping the real implementations (`vi.importActual`), then assert `ne` was called with `(storyIllustrations.source, 'custom')` in at least the force-delete case (the existing "deletes prior rows before inserting the fresh set when force is set" test is the natural place to extend, or add a new adjacent test). All pre-existing assertions in this file must continue to pass unchanged — they will, since the shallow `where: () => builder` / `where: vi.fn(async (cond) => {...})` mocks never branch on predicate content.

## Frontend implementation plan

### Modify: `packages/web/src/lib/api.ts`

1. Widen the type (~line 113): `source: 'automatic' | 'manual'` → `source: 'automatic' | 'manual' | 'custom'`. Before doing this, grep the web package for any code that branches on `illustration.source` (e.g. `=== 'manual'`) to confirm nothing needs a new `'custom'` case — as of this exploration, the gallery renders all sources identically, so no other file should need a change, but the implementer must re-verify at implementation time since the codebase may have moved on.
2. Add under `api.stories` (near `regenerateIllustrations`, ~line 722):
   ```ts
   generateCustomIllustrations: (storyId: number, input: { prompt: string; count?: number }) =>
     request<StoryIllustration[]>(`/api/stories/${storyId}/illustrations/custom`, {
       method: 'POST',
       body: JSON.stringify({ prompt: input.prompt, count: input.count }),
     }),
   ```

### Modify: `packages/web/src/components/story-illustration-gallery.tsx`

Add local state: `customPrompt` (string), `customCount` (number, default `2`), `generatingCustom` (boolean), `customError` (string | null). Add a collapsible block below the existing header row (or a `<details>`/toggle, matching this repo's existing collapsible patterns if any exist — otherwise a simple always-visible small form is acceptable given the component's low complexity budget):

- A `textarea` (`textarea textarea-bordered w-full`, matching e.g. `create-story-modal.tsx`'s convention) bound to `customPrompt`.
- A `number` input (`input input-bordered`, `min={1}`, `max={6}`, matching `inputs.stories.tsx`'s convention) bound to `customCount`, defaulting to `2`.
- A button ("Сгенерировать по промпту" or similar), disabled while `generatingCustom` or when `customPrompt.trim()` is empty, that:
  1. Shows the same `window.confirm` real-cost warning pattern `handleRegenerate` already uses (paid action).
  2. Calls `api.stories.generateCustomIllustrations(storyId, { prompt: customPrompt, count: customCount })`.
  3. On success: `setIllustrations((prev) => [...prev, ...newRows])` (additive, never replaces — matches Decision 3). If `newRows.length < customCount`, show an inline message (e.g. `Сгенерировано ${newRows.length} из ${customCount} — часть запросов не удалась`) per Decision 9, distinct from the generic error message used for a thrown exception.
  4. On thrown error: `setCustomError(err instanceof Error ? err.message : 'Не удалось сгенерировать иллюстрации')`.
  5. Clears `customPrompt` on success (optional UX nicety, not required for acceptance).

No changes needed to `story-reader.tsx` — the gallery component is already wired in and self-contained; this is purely internal to the existing component.

## Acceptance scenarios

1. **Happy path, default count.** `POST /api/stories/:id/illustrations/custom` with body `{ "prompt": "A fox reading a book under a blue moon" }` (no `count`) on a real/mocked existing story → exactly 2 calls to `aiRunner.generateImage`, each called with `prompt` equal to the input string verbatim and `referenceImageUrls: []` → response is `201` with an array of 2 items, each `source: 'custom'`, `orderIndex` `1000` and `1001` (assuming no prior custom rows for that story), `momentDescription` equal to the prompt verbatim.

2. **Custom count.** Same request with `{ "prompt": "...", "count": 4 }` → exactly 4 `generateImage` calls → response array of 4 items with `orderIndex` `1000..1003` (or continuing from the existing custom-row count if run a second time on the same story).

3. **Count validation.** `{ "prompt": "...", "count": 7 }` → `400`, `generateCustomIllustrations` never invoked (verify via mock call count of 0). Same for `count: 0` and `count: -1`.

4. **Prompt validation.** `{ "prompt": "" }` → `400`. `{ "prompt": "x".repeat(4001) }` → `400`.

5. **Story not found.** Valid body, nonexistent `storyId` → `201` with `[]` (matches Decision 9's established silent-empty convention — no `404`).

6. **Partial failure.** 2 of a requested 3 image calls reject → response is `201` with 2 items, no thrown exception, no 500. Frontend: `generateCustomIllustrations(storyId, { prompt, count: 3 })` resolving to 2 rows triggers the "generated fewer than requested" inline message, not the generic error path.

7. **Additive, never replaces.** Generate 2 custom images, then generate 2 more on the same story → `GET /:id/illustrations` (or a direct DB check) shows 4 total `source: 'custom'` rows with `orderIndex` `1000, 1001, 1002, 1003` — none of the first batch's rows were deleted or overwritten.

8. **Custom rows survive "regenerate album."** Given a story with 2 existing custom rows and an existing automatic/manual album, calling `POST /:id/illustrations/regenerate` (existing route, unchanged) deletes and rebuilds only the automatic/manual rows — after regeneration, `GET /:id/illustrations` still contains the same 2 `source: 'custom'` rows with their original `id`s and `orderIndex`es, unchanged, alongside the freshly-regenerated automatic/manual rows.

9. **Custom generation does not suppress a not-yet-run automatic album.** Given a story with 2 existing custom rows and **no** automatic/manual rows yet, a subsequent non-forced call to `generateIllustrationAlbum(storyId, storage)` (as any of the four ready-transition dispatch paths would make) still runs full automatic/manual moment selection and generation — it does **not** short-circuit via the idempotency check just because custom rows exist. (This is the regression Decision 4 exists to prevent; test it explicitly, not just implicitly via the three-site patch.)

10. **Existing automatic-on-approval scenario unaffected.** A story with zero marks and zero custom rows reaching `ready` status via any of the four existing dispatch call sites in `stories.ts` still triggers exactly the same automatic 2-moment generation as before these changes — `generate-illustration-album.test.ts`'s full existing test suite passes unmodified (aside from the one new regression test added per Decision 4).

11. **Existing manual-marker scenarios unaffected.** Marking passages, the "marks fill their own slots, automatic fills the rest" behavior (1 mark + 1 auto-picked; 2+ marks, automatic skipped entirely), and the marker cap of 6 all behave identically to before this change — verified by the existing `generate-illustration-album.test.ts` and `story-illustration-markers.test.ts` suites passing unmodified.

12. **Existing force-regenerate scenario unaffected when no custom rows exist.** `POST /:id/illustrations/regenerate` on a story with only automatic/manual rows (the common case today) behaves identically to before — deletes and rebuilds exactly as it did pre-change. Verified by the existing `story-illustrations.test.ts` "regenerates the album, forcing a fresh run" test passing unmodified.

13. **No migration artifact.** After widening `source`'s TypeScript union in `schema.ts`, running `npx drizzle-kit generate` from the repo root produces no new file under `packages/core/src/db/migrations/` (confirms the "plain `text()` column, no CHECK constraint" finding holds).

14. **UI renders custom images identically in the gallery/lightbox.** A custom-sourced illustration appears as a clickable thumbnail and opens the same lightbox with left/right paging as an automatic/manual one — no visual distinction required (matches how automatic/manual are already rendered identically today).

## Out of scope

- No character-identity conditioning, cast detection, or `buildIllustrationPrompt` involvement for custom-prompt images (Decision 1) — a follow-up could add an opt-in "attach style anchor" checkbox, but it is not built here.
- No async/Cloud-Tasks dispatch path for custom generation — synchronous only (Decision 5). If real-world latency at count=6 becomes a UX problem, migrating to the existing `dispatch-then-poll`/`dispatch-then-refresh` pattern is a reasonable future follow-up, not built here.
- No per-row deletion of individual custom illustrations, and no "regenerate this specific custom image" action — only bulk additive generation. Deleting a custom row (if ever needed) would go through the existing `delete-story-cascade.ts` path only, at story-deletion time.
- No history/retention concept for custom images beyond "never auto-deleted" — there is no cap on how many custom rows a story can accumulate over multiple generation calls (only a per-request cap of 6).
- No status-gating on when custom generation is allowed (draft/proofreading/ready/read) — mirrors how the existing "regenerate album" route has no status gate either.
- No new admin cost-breakdown UI surfacing the new `story_illustration_custom` stage specifically — the existing `model_calls` table already makes it auditable after the fact, same as every other stage in this app has no per-feature spend cap or dedicated dashboard.
- No changes to `select-illustration-moments.ts`, the `story-illustration-moments.md` skill, `load-story-cast.ts`, `match-character-names-to-cast.ts`, or `detect-cast-members-in-text.ts` — none of this machinery is used by the custom-prompt path.
