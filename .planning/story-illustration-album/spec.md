---
type: spec
branch: main
task: story illustration album
complexity: complex
state: confirmed
updated: 2026-08-22
---
# Spec: story illustration album

### Summary

Every story automatically gets a small picture-book album the moment it reaches "ready" status — no manual button, unlike the character-portrait feature this reuses infrastructure from. By default a cheap text call reads the finished story and picks the two most visually vivid moments plus which cast members appear in each. Separately, while reading or reviewing a story's text, a person can select any passage and mark it "illustrate this" — a real selection-toolbar action, stored as its own distinct data, editable at any time. **Manual marks fill their own slots first, and the automatic picker fills whatever's left up to the target of 2**: a story with one mark gets that mark illustrated plus one automatically-picked moment; a story with two or more marks gets only the marks illustrated, and the automatic picker doesn't run at all (it has no slots left to fill, so its cost is skipped too); a story with no marks is unchanged — the automatic picker alone fills both slots. Both kinds of illustration reuse any character's already-generated portrait as an identity reference and the app's single shared style asset as the art-style anchor, so every picture looks like the same universe the character portraits already do. Results appear as a clickable gallery with a paged lightbox on the story's reading page, plus a manual "regenerate whole album" action for when the current result disappoints.

**This is a real, recurring cost this app hasn't taken on before.** Every story that becomes ready to read now costs roughly $0.08 by default (two image calls at ~$0.039 each, plus a fraction of a cent for the cheap text call) regardless of whether those two moments came from marks, the automatic picker, or a mix of both — with no per-story confirmation step, unlike the character-portrait feature, which only ever spends money on an explicit button click. Only once marks alone already reach the target of 2 does cost start scaling with how many were marked, up to the fixed cap of 6 (~$0.23 at the cap, with no text-call cost at all once the automatic picker is skipped) — see Decisions for the cap's reasoning. A bulk import of older stories marked ready-to-read in one sitting (an existing, already-working import path) now carries the automatic per-story cost too — twenty stories imported at once costs roughly $1.60, automatically, the first time this ships.

### Implementation Phases

Single phase implementation. The work is naturally layered (derivers, then the shared moment-selection/generation orchestration, then the four ready-transition hook-points, then the marking UI, then the gallery UI) but ships as one connected feature — there's no meaningful intermediate deployable state between "database ready" and the whole thing working end to end.

### Derivers

| Deriver | Inputs | Output | Scenarios covered |
|---|---|---|---|
| `buildStoryIllustrationAssetPath` | `{ storyId: number, fileId: string, extension: string }` (`fileId` caller-supplied, e.g. `crypto.randomUUID()`, mirrors `buildCharacterAssetPath`'s pattern) | GCS object path string under a top-level `illustrations/` prefix — a sibling prefix to the existing `portraits/`/`references/` ones, in the same public bucket as `portraits/` | 1, 2, 5 |
| `buildIllustrationPrompt` | `{ moment: { kind: 'scene_description', text: string } \| { kind: 'story_excerpt', text: string }, charactersInMoment: Array<{ name: string, description: string, age: string \| null, traits: string \| null, hasIdentityReference: boolean }> }` + identity reference count — the discriminated `kind` matters: an automatic moment is the selector's own scene-description text, a manual mark is verbatim story prose, and the model needs different framing for each (see below) | prompt string — for `scene_description`, states the scene directly; for `story_excerpt`, explicitly frames the text as a verbatim quote from the story and instructs the model to illustrate the scene it depicts, never to render its words as text-in-image; both branches then list which attached reference images are identity-only for which named character (in order), state the final attached image is the sole style anchor, and instruct the model to invent the appearance of any character with `hasIdentityReference: false` from their bible fields rather than copying anyone else's face | 4, 8, 10 |
| `matchCharacterNamesToCast` | `{ characterNames: string[], cast: Array<{ id: number, name: string }> }` (case-insensitive, trimmed exact match — used for the automatic path's LLM-returned names) | `{ matchedCharacterIds: number[], unmatchedNames: string[] }` — an unmatched name is dropped, never blocks the moment | 8, 10 |
| `detectCastMembersInText` | `{ text: string, cast: Array<{ id: number, name: string }> }` (plain case-insensitive substring search, no model call — deliberately deterministic and free for the manual-mark path) | `{ matchedCharacterIds: number[] }` | 5, 8, 10 |

No deriver for the identity-reference-count cap (at most 3 identity images per moment, all matched characters still get their bible description in the prompt text regardless) — it's a one-line `slice(0, 3)` inside the orchestration function, not complex enough to warrant its own pure module and test file, unlike the character-portrait feature's full tier-selection algorithm.

### Files by scenario

| Scenario | Backend files | Frontend files | Infrastructure files |
|---|---|---|---|
| 1 — Auto-trigger, non-blocking, no marks | `packages/api/src/routes/stories.ts` (approve-text dispatch call), `packages/api/src/routes/pipeline-dispatch.ts`, `packages/api/src/routes/story-illustration-trigger.ts`, `packages/api/src/routes/internal-worker.ts`, `packages/core/src/story-illustrations/generate-illustration-album.ts`, `packages/core/src/pipeline/stages/select-illustration-moments.ts` | `packages/web/src/components/story-illustration-gallery.tsx` (re-fetches if empty) | None |
| 2 — Legacy import / user-authored story also gets an album | `packages/api/src/routes/stories.ts` (creation-route dispatch calls) | None (same gallery component) | None |
| 3 — No double-bill on a repeated ready transition | `packages/core/src/story-illustrations/generate-illustration-album.ts` (skip-if-album-exists guard), `packages/api/src/routes/stories.ts` (PATCH status dispatch call) | None | None |
| 4 — Marking a passage as a real selection action | `packages/api/src/routes/story-illustration-markers.ts` (POST), `packages/core/src/db/schema.ts` (`storyIllustrationMarkers` table) | `packages/web/src/components/annotation-toolbar.tsx` (new action button), `packages/web/src/pages/story-reader.tsx` (wiring, same `findTextOffset`/`SelectionState` mechanism already used for annotations) | None |
| 5 — Marks fill their own slots, automatic fills the rest up to 2 | `packages/core/src/story-illustrations/generate-illustration-album.ts` (computes remaining slots = max(0, 2 - markCount); calls the automatic selector only when remaining > 0, asking for exactly that many), `packages/core/src/pipeline/stages/select-illustration-moments.ts` (accepts a moment count + already-marked passages to avoid duplicating), `packages/core/src/story-illustrations/detect-cast-members-in-text.ts` | None | None |
| 16 — One mark plus one auto-filled moment in the same album | `packages/core/src/story-illustrations/generate-illustration-album.ts` (combines a manual moment and an automatic moment in one album, one `Promise.allSettled` across both) | `packages/web/src/components/story-illustration-gallery.tsx` (renders a mixed-source album identically to a single-source one — no visual distinction required) | None |
| 6 — Editing marks (add/remove) | `packages/api/src/routes/story-illustration-markers.ts` (DELETE, GET) | `packages/web/src/components/story-illustration-markers-panel.tsx` (list + delete) | None |
| 7 — Mark count cap | `packages/core/src/story-illustrations/validate-marker-limit.ts`, `packages/api/src/routes/story-illustration-markers.ts` | `packages/web/src/components/annotation-toolbar.tsx` (disables/hides the mark action once capped, shows why) | None |
| 8 — Identity reuse across both paths | `packages/core/src/story-illustrations/generate-illustration-album.ts`, `packages/core/src/story-illustrations/load-story-cast.ts`, `packages/core/src/story-illustrations/build-illustration-prompt.ts`, `packages/core/src/story-illustrations/match-character-names-to-cast.ts`, `packages/core/src/story-illustrations/detect-cast-members-in-text.ts` | None | None |
| 9 — Partial generation failure | `packages/core/src/story-illustrations/generate-illustration-album.ts` (`Promise.allSettled`, no retry) | `packages/web/src/components/story-illustration-gallery.tsx` (renders whatever count exists) | None |
| 10 — Character name mismatch (either path) | `packages/core/src/story-illustrations/match-character-names-to-cast.ts`, `packages/core/src/story-illustrations/detect-cast-members-in-text.ts` | None | None |
| 11 — Gallery + lightbox on the reading page | `packages/api/src/routes/story-illustrations.ts` (GET route) | `packages/web/src/components/story-illustration-gallery.tsx`, `packages/web/src/pages/story-reader.tsx` (wiring) | None |
| 12 — Manual "regenerate album" | `packages/api/src/routes/story-illustrations.ts` (POST regenerate route), `packages/core/src/story-illustrations/generate-illustration-album.ts` (`force` option, re-reads current marks each time) | `packages/web/src/components/story-illustration-gallery.tsx` (button + confirm) | None |
| 13 — Revert-and-reapprove doesn't auto-refresh | No new file — verified by the absence of any dispatch call in the existing revert-to-proofreading route | None (scenario 12's manual button is the escape hatch) | None |
| 14 — Deleting a story with an album/marks still works | `packages/api/src/routes/delete-story-cascade.ts` | None | None |
| 15 — Story has no usable text yet | `packages/core/src/story-illustrations/generate-illustration-album.ts` (guard clause) | None | None |

### Files to create

```
packages/core/src/story-illustrations/
  build-story-illustration-asset-path.ts   — pure: GCS object path naming (top-level `illustrations/` prefix)
  build-story-illustration-asset-path.test.ts
  build-illustration-prompt.ts             — pure: moment/mark + per-character identity/invent instructions -> prompt
  build-illustration-prompt.test.ts
  match-character-names-to-cast.ts         — pure: free-text character names from the automatic selector -> matched
                                              cast IDs, unmatched names dropped (never blocks the moment)
  match-character-names-to-cast.test.ts
  detect-cast-members-in-text.ts           — pure: plain case-insensitive substring search for known cast names
                                              inside a manually marked passage — deliberately not a model call, so
                                              a manual mark never depends on (or pays for) any AI re-interpretation
                                              of the exact text the person chose
  detect-cast-members-in-text.test.ts
  validate-marker-limit.ts                 — pure: current marker count for a story vs. the fixed cap -> allow/deny
  validate-marker-limit.test.ts
  load-story-cast.ts                       — DB reads: merges `loadCharactersWithPortrait` (reused from
                                              `character-portraits/`) across every universe a story is linked to,
                                              deduped by character id — supplies both the automatic selector's
                                              known-cast list and every moment/mark's identity-reference lookup
  generate-illustration-album.ts           — orchestration: load story text -> skip if an album already exists
                                              (unless `force`) -> load cast -> load current marks for the story ->
                                              build one manual moment per mark (tagged `story_excerpt`),
                                              `detectCastMembersInText` for each -> compute `remainingSlots =
                                              max(0, TARGET_COUNT - markCount)` where `TARGET_COUNT` is 2 -> only
                                              when `remainingSlots > 0`, run the automatic moment selector asking
                                              for exactly `remainingSlots` moments (tagged `scene_description`),
                                              passing the marks' own text as "already covered, don't duplicate"
                                              context so the automatic picker doesn't re-pick the same beat; when
                                              `remainingSlots` is 0 (marks already meet or exceed the target), the
                                              automatic selector is not called at all, saving its cost -> if the
                                              automatic selector call itself fails (rather than returning moments),
                                              that failure is caught and treated as zero automatic moments — any
                                              manual moments already collected still proceed to image generation
                                              regardless, only the automatically-filled slots end up missing from
                                              the resulting album, same "partial album, no automatic retry"
                                              handling as any other partial failure -> combine
                                              the manual moments (in mark-creation order) with any automatic
                                              moments (in the selector's own returned order) into one ordered list
                                              -> for each resulting moment (either source), cap identity references
                                              at 3, resolve reference image URLs (public portrait URLs + the shared
                                              default-style asset, always last) -> build prompt -> `Promise.
                                              allSettled` across all image-generation calls, manual and automatic
                                              together -> upload each success to GCS -> insert one
                                              `story_illustrations` row per success, tagged with its source
                                              (replacing prior rows first when `force` is set) -> return whatever
                                              rows exist
packages/core/src/pipeline/stages/
  select-illustration-moments.ts           — wraps `aiRunner.runStructured` with the new skill, resolves its model
                                              via `resolveStageModel(story.groupId, 'illustrationMomentSelector')`,
                                              mirrors `story-analyzer.ts`'s existing wrapper shape exactly; takes a
                                              `count` (the number of moments to return — up to 2, and strictly less
                                              than 2 whenever at least one mark already exists) and an optional list
                                              of already-marked passage texts, folded into the prompt as moments to
                                              avoid duplicating — a small addition to the prompt text, no schema
                                              change, so it was cheap enough to include rather than deferring
packages/core/src/pipeline/assets/
  load-default-style-image.ts              — pure extraction of the base64-data-URI loader that already lives
                                              inline inside `generate-portrait.ts`, moved so both that file and the
                                              new illustration generator share one copy — `generate-portrait.ts`'s
                                              own behavior is byte-for-byte unchanged, only where the loader lives
  load-default-style-image.test.ts
packages/core/src/skills/
  story-illustration-moments.md            — new skill (Russian-language body, matching every existing skill file):
                                              given the story's full text and its known cast names, return exactly
                                              2 moments, each a short scene description plus the named characters
                                              (if any) who appear in it, chosen for what a child would most want to
                                              see drawn — visually concrete, emotionally vivid, spread across the
                                              story rather than clustered in one scene
packages/api/src/routes/
  story-illustration-trigger.ts            — `triggerIllustrationAlbum(storyId)`: fire-and-forget wrapper around
                                              `generateIllustrationAlbum`, mirrors `story-analysis.ts`'s
                                              `triggerAnalysis` exactly, `.catch(console.error)`, never throws
  story-illustrations.ts                   — GET (list current album) / POST `/regenerate` (force a fresh album,
                                              synchronous — latency is at most one cheap text call plus a handful of
                                              parallel image calls, well inside this app's existing text-generation
                                              request timeouts, so no new polling infra is needed)
  story-illustration-markers.ts            — POST (create a mark: `{ text, position_start, position_end }`,
                                              enforces `validateMarkerLimit` and the same 2000-char selection cap
                                              annotations already use) / GET (list current marks for a story) /
                                              DELETE `/:markerId` (remove one mark) — "editing" a mark is delete +
                                              re-mark, matching how this app already treats annotations (no
                                              in-place boundary editing anywhere in this codebase today)
packages/web/src/components/
  story-illustration-gallery.tsx           — self-fetches the album for a given story id on mount; renders a
                                              thumbnail row (however many images exist), a lightbox on click with
                                              left/right paging, a "regenerate album" button with the same
                                              `window.confirm` cost-warning pattern `character-portrait-panel.tsx`
                                              already uses, and an empty/loading state that renders nothing
                                              disruptive while an automatic run is still in flight in the background
  story-illustration-markers-panel.tsx     — self-fetches current marks for a story id; renders each as a small
                                              chip/list item with its text snippet and a delete button; shown near
                                              the story text, visible regardless of story status
```

### Files to modify

```
packages/core/src/db/schema.ts
  — add `storyIllustrations` table (id, storyId FK -> stories.id, storagePath, momentDescription, source
    ($type<'automatic' | 'manual'>()), characterIds (jsonb, nullable, int[] — may be an empty array when no cast
    member was matched), orderIndex, generatedAt) — see Data model changes
  — add `storyIllustrationMarkers` table (id, storyId FK -> stories.id, markedText, positionStart, positionEnd,
    createdAt) — see Data model changes; deliberately its own table, not a new `annotations.type` value, per the
    explicit requirement that a marked fragment never shares storage with the general narrative text or with any
    other annotation type

packages/core/src/pipeline/derivers/per-stage-models.ts
  — add `'illustrationMomentSelector'` to `PIPELINE_STAGES` (alongside the existing 15 stages; this is the backend
    override-resolution list, not the narrower 3-stage admin swap-model UI in `pipeline-stages.ts`, which is
    untouched — the new stage needs no admin UI surface, same as `storyAnalyzer`/`ideaSuggester` today)

packages/core/src/pipeline/derivers/stage-defaults.ts
  — give `illustrationMomentSelector` the same cheap-tier default as `ideaSuggester`
    (`{ model: CHEAP_MODEL, fallback: PRIMARY }`, i.e. `deepseek/deepseek-v4-flash` primary,
    `deepseek/deepseek-v4-pro` fallback) — the only other stage in this app already configured cheap, so this
    follows the one existing precedent rather than inventing a new tier

packages/core/src/character-portraits/generate-portrait.ts
  — replace its inline `loadDefaultStyleImageDataUri` function body with an import from the new
    `pipeline/assets/load-default-style-image.ts` — behavior unchanged, byte-for-byte, only the loader's location
    moves so the illustration generator can share it instead of duplicating base64-file-read logic

packages/core/src/ai/runner.interface.ts
  — add `storyId?: number` to `RunImageOptions` — a portrait call still leaves it undefined (no behavior change
    there); an illustration call sets it so its cost row attributes to the story, not just the character

packages/core/src/openrouter/openrouter.runner.ts
  — `generateImage()`: thread `options.storyId ?? null` into both `this.recorder.record()` calls (success and
    failure) instead of the current hardcoded `storyId: null` — this was a real, pre-existing gap: `model_calls`
    already has a nullable `story_id` column and every text-generation call already threads it through, but the
    image-generation method never had a caller that needed to until now

packages/api/src/routes/pipeline-dispatch.ts
  — add `dispatchIllustrationAlbum(storyId: number): Promise<void>`, same shape as the existing
    `dispatchAnalysis` — enqueues `/api/internal/worker/illustrations` when the Cloud Tasks queue is configured,
    falls back to `triggerIllustrationAlbum(storyId)` in-process otherwise

packages/api/src/routes/internal-worker.ts
  — add `POST /illustrations` (same shared-secret auth middleware already guarding this router), validates
    `{ storyId }`, calls `generateIllustrationAlbum(storyId, objectStorage)`

packages/api/src/routes/stories.ts
  — after the `status: 'ready'` write in `POST /:id/approve-text` succeeds: `void
    dispatchIllustrationAlbum(storyId).catch((err) => console.error(...))`, same fire-and-forget pattern already
    used there for `dispatchAnalysis`
  — after the `status: 'ready'` write in `POST /` (both the legacy-import-with-addToReadingList branch and the
    user-authored-story branch): same dispatch call, using the newly-created story's id
  — in `PATCH /:id/status`: after a successful update, if the new `status` is `'ready'`, same dispatch call —
    the orchestration function's own skip-if-exists guard is what actually prevents a duplicate/double-billed run
    here, not a status-transition check at this call site (kept deliberately simple — see Decisions)

packages/api/src/routes/delete-story-cascade.ts
  — add deletions of `storyIllustrations` and `storyIllustrationMarkers` rows (both keyed by `storyId`) before the
    final `stories` delete, alongside every other story-owned table already cleaned up here — without this, the
    first story with an album or a mark becomes permanently undeletable on a foreign-key violation, the exact
    failure mode already fixed once for characters in the portrait feature

packages/api/src/server.ts
  — mount the new `story-illustrations.ts` and `story-illustration-markers.ts` routers at the same `/api/stories`
    prefix `stories.ts` already uses (Express supports multiple routers sharing one mount prefix; this repo already
    does this for other story-scoped route files)

packages/web/src/lib/api.ts
  — add `StoryIllustration { id, imageUrl, momentDescription, source, orderIndex }` (`imageUrl` a plain public URL,
    no signing needed — same bucket, same public-read grant portraits already use)
  — add `StoryIllustrationMarker { id, text, positionStart, positionEnd }`
  — add under `api.stories`: `listIllustrations(storyId)`, `regenerateIllustrations(storyId)`,
    `listIllustrationMarkers(storyId)`, `createIllustrationMarker(storyId, input)`,
    `deleteIllustrationMarker(storyId, markerId)`

packages/web/src/components/annotation-toolbar.tsx
  — add one more action button ("Иллюстрация" / mark-for-illustration) alongside the existing reaction buttons,
    calling a new, **optional** `onMarkForIllustration?(selectedText)` prop (mirrors how `onChatAboutThis?` is
    already declared optional on this same component) rather than overloading the existing `onAnnotate` (marks are
    not annotations — see Data model changes), disabled with an inline reason once the story's marker count is
    already at the cap. Unlike `onChatAboutThis` — which is declared on `AnnotationToolbarProps` and passed from
    `story-reader.tsx` today but never actually destructured or rendered inside the component body, so it's
    currently dead wiring — the new prop must actually be destructured and rendered; don't copy that existing gap.

packages/web/src/pages/story-reader.tsx
  — wire the toolbar's new action to the marker-creation API call, reusing the exact same `findTextOffset`
    global-offset resolution already used for annotation creation
  — render `<StoryIllustrationMarkersPanel storyId={storyId} />` near the text, visible regardless of story status
  — render `<StoryIllustrationGallery storyId={storyId} />` once, gated on `(currentStatus ?? story.status)` being
    `'ready'` or `'read'`, placed after the tags box and before the cost-breakdown box — see Decisions for why
    this placement
```

### Data model changes

New tables:

```
story_illustrations
  id                    serial primary key
  story_id              integer not null references stories(id)
  storage_path          text not null   -- e.g. "illustrations/812/<uuid>.png" — bucket-relative path in the same
                                          -- public bucket portraits already use; public URL always derivable the
                                          -- same way `build-public-object-url.ts` already does for portraits
  moment_description    text not null   -- the exact text used to build the prompt — the automatic selector's own
                                          -- scene-description text for an automatic row, or the marked passage's
                                          -- verbatim prose for a manual row (see below: never the general story
                                          -- text). `source` (next column) says which kind of text this is, since
                                          -- `buildIllustrationPrompt` frames the two differently — a scene
                                          -- description is illustrated directly, a verbatim excerpt is explicitly
                                          -- framed as "this is a quote, illustrate the scene, don't render the
                                          -- words as text-in-image" — conflating the two risks the model rendering
                                          -- quoted dialogue as literal text in the picture
  source                text not null   -- 'automatic' | 'manual' — which path produced this illustration; also
                                          -- doubles as which prompt framing `moment_description` was built with
                                          -- (kept for audit, mirrors how `character_portraits.tier` already
                                          -- records provenance)
  character_ids         jsonb, nullable  -- int[] of matched universe_characters ids for this moment; may be an
                                          -- empty array when no characters were named or none matched
  order_index           integer not null -- 0-based ordering for the gallery/lightbox: the automatic selector's own
                                          -- moment ordering for automatic rows; for manual rows, the order the
                                          -- marks were created in — deliberately NOT derived from each mark's
                                          -- `position_start`, since that offset is only ever a snapshot at marking
                                          -- time and can drift out of sync with the text after an edit (see below)

story_illustration_markers
  id                serial primary key
  story_id          integer not null references stories(id)
  marked_text       text not null    -- the exact selected substring, capped at the same 2000 characters this app
                                       -- already enforces for annotation selections — this is the field the
                                       -- product requirement calls out: it is what a marked illustration's prompt
                                       -- is built from, and it is never written into, or read from, `stories.text_*`
                                       -- or the `annotations` table
  position_start    integer not null  -- offset into the text at the time of marking, used only to re-highlight the
                                       -- marked span for editing/removal in the UI
  position_end      integer not null
  created_at        timestamp default now()
```

`story_illustration_markers` is a **new table, not a new `annotations.type` value** — a deliberate, explicit modeling choice (not just convenience): the `annotations` table already feeds an unrelated learning pipeline (parent-feedback formatting, style-guide updates) that iterates its rows by type, and mixing marker rows into that table would risk a marked passage's text leaking into a pipeline it was never meant to reach unless every one of those call sites remembered to filter the new type out. A dedicated table makes "never mixed with anything else" true by construction rather than by discipline.

**Generation reads `marked_text` directly, never re-locates it via its stored offsets.** `positionStart`/`positionEnd` exist only so the UI can re-highlight a mark for editing; if the story's text is edited after a mark is created, the offsets may no longer point at the same span, but the marked text itself remains a perfectly valid illustration prompt input regardless — the same accepted-staleness reasoning already applied to a regenerated album after a text-changing revert (see Scenario 13).

No change needed to `model_calls` — it already carries a nullable `story_id` (used by every text-generation stage already) which both the automatic moment-selection call and each image call attribute their cost to. `model_calls.character_id` (added for the portrait feature) is deliberately left null for illustration rows — one illustrated moment can span several characters, and this column only ever attributes a call to one thing, so it isn't a good fit here; per-moment character traceability instead lives on `story_illustrations.character_ids`.

Migration generated via `npx drizzle-kit generate`, applied via `npm run db:migrate` — never `drizzle-kit migrate` directly, per this repo's own CLAUDE.md.

**A manual regenerate replaces rows outright, no history.** Unlike character portraits (which the product owner explicitly asked to keep up to 3 previous versions of), a regenerated illustration album simply deletes the story's existing `story_illustrations` rows and inserts a fresh set — no previous-album retention table. Nobody has asked for illustration history, and a story only ever has one "current" album's worth of rows to begin with (never a growing list), so there's no natural place a retention policy would even attach without inventing one nobody requested. Markers themselves are never touched by a regenerate — only the generated images are replaced.

### Seed data

This repo has no scripted seed mechanism — automated tests mock the DB client directly (the `vi.mock('@bedtime/core/db/client', ...)` pattern already used throughout `packages/api/src/routes/*.test.ts`), and manual verification is done against the real accumulated data on the Neon dev branch.

| Scenario | Realistic data needed | Source |
|---|---|---|
| 4, 5, 6, 7 (marking passages, cap) | Any real dev-branch story with editable text, in any status — marking works regardless of status | Select text on any real dev-branch story's reading page |
| 8, 10 (identity reuse, name mismatch) | A universe with at least one character that already has a generated portrait and at least one that doesn't, and a `ready` story in that universe whose text mentions both by name in the same scene | Generate one portrait via the existing character-portrait feature first, then approve or mark a real dev-branch story in that universe |
| 1, 2, 3, 9, 11, 12, 13, 14, 15 | Verifiable against any real dev-branch story reaching `ready` through its normal approval flow, or a throwaway story created via the legacy/user-story creation path | Any real dev-branch universe/story; no special setup beyond approving, marking, or creating a story |

### Documentation changes

- `docs/architecture/story-illustration-album.md` created — new component doc, following this repo's flat, unnumbered `docs/architecture/` convention already used by `story-retrieval.md` and `universe-memory-sync.md` (not every doc in this repo is numbered; numbering was specific to the original 01-06 set). Plain-language explanation, covering both the automatic and manual-mark paths, plus the diagram already produced for this plan (`architecture-diagram.mmd`/`.png` in this planning folder, copied/adapted into `diagrams/story-illustration-album.mmd` and `img/story-illustration-album.png`).
- `docs/architecture/04-feedback-and-review.md` updated — this doc already covers the proofreading/annotation loop on the reading page; add a short note that the same selection mechanism also supports marking a passage for illustration, distinct from the annotation types already documented there, so a reader of that doc isn't surprised by a second selection-driven action living on the same page.
- `docs/architecture/05-data-model.md` updated — ER diagram gains `story_illustrations` and `story_illustration_markers` and their relationships to `stories`.
- `docs/architecture/README.md` updated — new row in the doc index table.
- `docs/architecture/01-system-overview.md` and `02-story-generation.md` intentionally left untouched — neither makes a claim this feature invalidates (unlike the portrait feature, which shipped the storage bucket's first real use and had to correct a stale "for future use" bullet).

### Decisions made autonomously

- Plan folder is `.planning/story-illustration-album/` (flat, no ticket prefix) — matches this repo's existing `.planning/` layout, same reasoning `character-base-images/` already established for this repo.
- **All four code paths that can set a story's status to `ready` get the dispatch call, not just the main approve-text flow** — verified by reading every write site of `status: 'ready'` in this codebase: the main `approve-text` route, the legacy-import-with-`addToReadingList` and user-authored-story branches of story creation, and the generic status-update route. This deliberately goes further than the existing story-analysis side effect, which today only fires from the main approve-text route — analysis was scoped narrower when it was built; illustration is scoped to "every path that reaches ready" per this task's explicit brief.
- **A one-off, offline bulk-import script (`packages/core/src/scripts/notion-import.ts`) that writes `stories` rows directly to the database, bypassing every API route, is deliberately NOT wired to this side effect.** It's a manually-run historical migration tool, not a live request path, and it can insert many `ready`-status rows in one run — auto-triggering paid illustration generation for a large batch of old imported stories nobody asked to have illustrated would be a real, easy-to-miss cost surprise.
- **There is a substantial, previously unmerged attempt at a similar feature already sitting in this codebase's history** — a `story-images` branch/worktree (still present as a local git worktree, never merged) that generated up to 3 illustrations per story using an older, since-superseded storage/reference-image design. This plan does not reuse any of its code — the character-portrait feature has since rebuilt the storage/OpenRouter/cost-tracking infrastructure this plan actually builds on. Worth a human decision, outside this plan's scope, on whether that old worktree/branch should be deleted now that this plan supersedes its intent.
- **Confirmed by the coordinator: manual marks fill their own slots, and the automatic picker fills whatever's left up to the target of 2 — "ручные + авто дозаполнение."** This resolves the one point this plan originally flagged as needing confirmation (the product brief's own hedged "presumably" wording). A story with 0 marks: automatic picks 2, unchanged. 1 mark: that mark plus 1 automatically-picked moment. 2+ marks: only the marks, automatic picker skipped entirely (no slots left, no cost spent choosing).
- **The automatic moment-picking call only runs when marks haven't already filled the target of 2, and asks for only the remaining count** — when it does run alongside existing marks, the marks' own text is passed along as context so the automatic picker doesn't duplicate a beat someone already chose by hand; when marks already meet or exceed the target, the call is skipped entirely, saving its (small) cost.
- **Combining manual and automatic moments in one album orders manual moments first (by mark-creation order), then automatic moments (in the selector's own order)** — rather than attempting a true story-chronological interleave across two different position-tracking mechanisms (a mark's stored offset, which can drift after a text edit, vs. the selector's own reading of the current text). A deliberate simplification: correct enough for a 2-image album, and avoids inventing a shared "position in story" concept neither path currently has.
- **Manual-mark character detection is a plain text search, not a model call** — deliberately deterministic and free, and it keeps the marked passage's exact text as the only thing that determines the illustration, with no AI re-interpretation layered on top of a choice the person already made explicitly.
- **Marker cap set at 6 per story** — my own judgment call, not specified in the brief. Reasoning: a bedtime story is short enough that a person would realistically mark somewhere between 1 and 4 moments; 6 is generous headroom above that while still bounding worst-case cost per story (6 × ~$0.039 ≈ $0.23) to roughly the same order of magnitude as the automatic default, rather than leaving it uncapped. Enforced server-side (rejects a 7th mark) and reflected in the UI (the mark action disables once reached, with a visible reason).
- Illustration image calls run in parallel (`Promise.allSettled` across all of them), not sequentially — same total cost either way, but a large reduction in how long a story's owner waits for the background result to finish. This does raise the chance any single one gets rate-limited compared to running them one at a time; accepted deliberately, since a rate-limited call just becomes one missing picture in an otherwise-complete album (see Scenario 9), not a blocked story.
- No automatic retry of a failed individual image within an album — mirrors the character-portrait feature's own "surface the failure, let a person decide" philosophy for a paid, one-click-adjacent action, rather than silently spending more to route around a possibly-systemic failure.
- Identity reference images are capped at 3 per moment (matching the existing sibling-portrait cap already used elsewhere in this app), plus the mandatory style-anchor image — 4 total, within the range this app has already verified working for a single generation call. Any additional matched characters in a crowded scene still get their bible description folded into the prompt text, just without a dedicated reference image.
- An unmatched character name (automatic path) or undetected cast mention (manual path) is dropped, never blocks generation — a deliberate fail-open choice, distinct from how the character-portrait feature's own money-safety gate fails closed when a model isn't in the cost catalog. A missing catalog row is a real, silent cost-tracking gap; a misnamed or missed character is a cosmetic identity-reference miss, and illustrating anyway (just without that one identity reference) is strictly better than losing an illustration to a naming quirk.
- **Accepted limitation of the manual-mark path specifically**: `detectCastMembersInText`'s plain substring search only catches a character mentioned by name. A marked passage that refers to a character only by pronoun gets no identity reference for them, even if they're the automatic path's most-illustrated character elsewhere. Not fixed by expanding the search window into surrounding text or adding a model call to resolve pronouns — both add real complexity for what a person can already work around themselves (mark a slightly wider passage that includes the character's name, or use the manual regenerate action after noticing the miss).
- The illustration image model is reused as a fresh local constant in the new `story-illustrations/` module (`'google/gemini-2.5-flash-image'`) rather than importing the constant `character-portraits/generate-portrait.ts` already exports — a deliberate small duplication to keep the two feature domains decoupled from each other's internals.
- Regenerating an album replaces its rows outright with no retained history, unlike portraits — see Data model changes.
- "Editing" a mark is delete-and-recreate, not in-place boundary editing — this app has no existing precedent for in-place-editing a text-position annotation anywhere, and building one just for marks would be new, unrequested complexity when delete-and-remark achieves the same outcome with a UI action that already exists in the same panel.
- Marking is available regardless of story status (draft/proofreading/ready/read), since the underlying text-selection mechanism this reuses is itself already active at every status on this page today — restricting marking to only one status would be a new, inconsistent special case, not a simplification.
- Idempotency (never double-billing a story that already has an album) lives entirely in the orchestration function's own skip-if-exists check, not in per-route "did the status actually change" logic at each of the four call sites — simpler to reason about with one source of truth.
- The gallery is placed on the reading page after the tags box and before the cost-breakdown box — illustrations are the visual, emotional payoff a parent or child would want to see first; the cost-breakdown table is an audit-oriented detail that already sits further down the page, and this is a low-stakes, easily-reversible UI placement call. The markers panel is placed near the text itself, since marking is an action performed while looking at the text, not a downstream result.
- No infrastructure change ships with this plan — verified directly against the real provisioned Pulumi source that the public bucket's public-read grant is bucket-wide, not scoped to a `portraits/`-only prefix. The new `illustrations/` prefix in the same bucket is covered automatically.

### Implementation order

1. Schema migration: `storyIllustrations` + `storyIllustrationMarkers` tables — generate + apply via `npm run db:migrate`
2. `buildStoryIllustrationAssetPath` — deriver, red-green-refactor
3. `matchCharacterNamesToCast` — deriver, red-green-refactor, covers SCENARIO 8, 10
4. `detectCastMembersInText` — deriver, red-green-refactor, covers SCENARIO 5, 8, 10
5. `validateMarkerLimit` — deriver, red-green-refactor, covers SCENARIO 7
6. `buildIllustrationPrompt` — deriver, red-green-refactor, both `scene_description`/`story_excerpt` framings, covers SCENARIO 4, 8, 10
7. `load-default-style-image.ts` extraction — move the loader out of `generate-portrait.ts`, red-green-refactor to confirm identical behavior, update `generate-portrait.ts`'s import
8. `RunImageOptions.storyId` + `openrouter.runner.ts`'s `generateImage()` threading it through to both `recorder.record()` calls
9. `per-stage-models.ts` + `stage-defaults.ts` — add `illustrationMomentSelector` stage
10. `story-illustration-moments.md` skill file (2 moments, not 4)
11. `select-illustration-moments.ts` — pipeline stage wrapper, mirrors `story-analyzer.ts`
12. `load-story-cast.ts` — DB reads, merges cast + portrait status across every universe a story is linked to
13. `story-illustration-markers.ts` routes (POST/GET/DELETE) — covers SCENARIO 4, 6, 7
14. `generate-illustration-album.ts` — orchestration, manual-fills-slots-automatic-fills-the-rest branching, covers SCENARIO 1, 3, 5, 8, 9, 12, 15, 16
15. `story-illustration-trigger.ts` — fire-and-forget wrapper
16. `pipeline-dispatch.ts`'s `dispatchIllustrationAlbum` + `internal-worker.ts`'s `POST /illustrations`
17. Wire the four `stories.ts` call sites (approve-text, both creation branches, PATCH status) — covers SCENARIO 1, 2, 3
18. `delete-story-cascade.ts` — covers SCENARIO 14
19. `story-illustrations.ts` routes (GET, POST regenerate), mount both new routers in `server.ts` — covers SCENARIO 11, 12
20. `packages/web/src/lib/api.ts` — types, new `api.stories.*` methods
21. `annotation-toolbar.tsx` — new mark-for-illustration action, cap-reached disabled state — covers SCENARIO 4, 7
22. `story-illustration-markers-panel.tsx` + wiring in `story-reader.tsx` — covers SCENARIO 6
23. `story-illustration-gallery.tsx`, wired into `story-reader.tsx` — covers SCENARIO 9, 11, 12 (client side)
24. Documentation: `docs/architecture/story-illustration-album.md` (+ diagrams/img), update `04-feedback-and-review.md`, `05-data-model.md`, `README.md`

### Scope boundary

- No wiring into any list/card view of stories (e.g. a thumbnail on the story browsing list) — this is the reading page's gallery only.
- No configurable automatic illustration count beyond the fixed default of 2 — not exposed as a per-story or per-universe setting in this pass.
- No history/retention for regenerated albums — replaced outright (see Data model changes).
- No automatic retry of a failed individual image — a person uses the manual regenerate action if they want a complete set (see Decisions).
- No automatic refresh of an album after a story is reverted to proofreading and re-approved with changed text, or after marks are changed post-generation — the existing album is left in place; the manual regenerate action is the intended way to refresh it (see Scenario 13).
- No in-place editing of a mark's boundaries — delete and re-mark (see Decisions).
- The offline `notion-import.ts` bulk-import script is not wired to this side effect (see Decisions) — no changes to that script in this pass.
- No changes to `character-portraits/generate-portrait.ts`'s own generation behavior — the only touch to that file is where its style-image loader lives, not what it does.
- No spend cap or running-cost display specific to illustrations beyond the fixed 6-mark cap — matches how the rest of this app has no per-feature spend caps anywhere; the existing `model_calls` table already makes this auditable after the fact.
- No decision made in this pass about the old, unmerged `story-images` worktree/branch — flagged for a human decision, not acted on here.
