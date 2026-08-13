---
type: spec
branch: main
task: Cap annotation note_text and selected_text length in validation and every capture UI, with a resolved UX treatment for selected_text (a live browser selection, not typed input) before its cap can be applied without surprising the user mid-flow (GH #305)
complexity: medium
state: confirmed
updated: 2026-08-13
---
# Spec: Annotation text length validation

### Why

Direct fast-follow to #119 (`44f062e`, "Cap diary entry length at 2000 characters"), explicitly
scoped out of that ticket because `createAnnotationSchema` (`packages/api/src/routes/stories.ts:89-96`)
has two fields, not one, and they are structurally different:

- `note_text` — typed input. Same shape as diary content: capping it is a direct copy of #119's pattern.
- `selected_text` — a live `window.getSelection()` capture over existing text, not typed. The user
  never sees a character-count-as-they-type signal because there's nothing being typed. A bare
  `.max()` here means a parent who selects a long passage gets an opaque rejection with no
  explanation, which is exactly the harm #119's own spec named when it deferred this field.

Verified against current code: both fields are still `z.string().min(1).optional()` / `z.string().optional()`
with no `.max()` (`stories.ts:89-96`, unchanged since #119).

### Scope is wider than the issue body assumed — three capture surfaces per field, not one

The issue body cites only `annotation-toolbar.tsx` for both fields. Reading the actual codebase found
`createAnnotationSchema` is one shared schema used from **three** independent frontend components, each
with its own `window.getSelection()` + popover/toolbar implementation:

| Surface | File | `selected_text` capture | `note_text` capture |
|---|---|---|---|
| Story reader (finished text) | `packages/web/src/pages/story-reader.tsx` (`StoryText`) → `packages/web/src/components/annotation-toolbar.tsx` | `handleMouseUp`, `window.getSelection()` | single-line `<input>` |
| Text review (draft text) | `packages/web/src/pages/text-review.tsx` (`TextAnnotationPanel`) | `handleMouseUp`, `window.getSelection()` | `<textarea rows={2}>` "comment" |
| Plan review | `packages/web/src/components/plan-annotator.tsx` (`PlanAnnotator`) | `handleMouseUp`, `window.getSelection()` | `<textarea rows={2}>` "comment" |

All three call the same `api.annotations.create` → the same `POST /:id/annotations` → the same schema.
This matters for two reasons:

1. A `.max()` on the schema applies to all three regardless of which UI enforces it, so all three need
   the companion UI treatment — not just `annotation-toolbar.tsx` — or two of the three surfaces get a
   raw post-submit rejection with no counter, undermining AC 2/3 exactly the way #119 flagged for a
   single surface.
2. `note_text`'s two textarea surfaces (text-review/plan comments) are longer-form feedback than the
   single-line reaction note — the cap has to be sized for the widest legitimate use, not the narrowest
   input widget, or genuine plan/text feedback silently starts failing.

### `selected_text` UX decision: reject at the toolbar/popover render moment, not mid-gesture or bare-submit

**Decision, logged to `/Users/ikushlianski/webdata/ilya-projects/ORCHESTRATOR-MEETING-NOTES.md`
(2026-08-13) per the recommended-default rule — this is a real product-behavior choice, not asking-back
material, since every option had a resolvable default.**

All three components already share one structural fact: the selection UI (toolbar/popover) only
appears **after** `window.getSelection()` fires on `mouseup` — i.e. after the user has already finished
dragging. There is no existing mid-drag signal (no `selectionchange` listener, no live length readout
during the gesture) in any of the three components today. Two real options were considered:

- **A — live length feedback during the drag** (`selectionchange` listener, updating a counter as the
  user extends the selection). Rejected: this is new interaction machinery none of the three components
  has, would require re-deriving anchor/focus node math independently from the existing
  `range.getBoundingClientRect()` positioning logic in all three `handleMouseUp` handlers, and fights
  the browser's own native selection UI mid-gesture for a benefit (seeing the count tick up while
  dragging) that's marginal next to option C below — disproportionate effort for a hobby-project ticket
  scoped as `type:chore`.
- **B — clamp/truncate the selection to the cap automatically.** Rejected outright: AC 3 says "no silent
  truncation" for either field, and silently keeping only the first N characters of what the user
  visibly selected is worse than rejecting — the saved annotation would visibly not match what was
  highlighted on screen.
- **C — reject at the moment the toolbar/popover renders, before any submit button is reachable in an
  enabled state.** Selected. The toolbar/popover in all three components already renders exactly once
  per completed selection (on `mouseup`), before the user has clicked anything. Checking the length at
  that exact render point and swapping the normal controls (reaction buttons / note textarea + Save) for
  a plain Russian message means the user never reaches a live "Save" button in an enabled state for an
  over-limit selection, and never sees a raw post-submit error. This reuses the render moment and
  positioning logic all three components already have — no new event listeners, no new state shape
  beyond a length comparison already available as `selection.text.length` / `popover.text.length`.

  **The dismiss affordance for the too-long state is asymmetric across the three surfaces, and that's
  correct, not an inconsistency to fix.** `text-review.tsx` and `plan-annotator.tsx` own their popover
  state directly (local `popover`/`setPopover`, local `handleDismiss`) and already render an "Отмена"
  button — the too-long message reuses that same local dismiss. `annotation-toolbar.tsx` does not own
  its dismissal: `AnnotationToolbarProps` is `{ onAnnotate, selectedText }` only, and the toolbar
  unmounting is entirely driven by the parent (`story-reader.tsx`'s `handleAnnotationDismiss`, called
  today only inside the `onAnnotate` callback at line 561). Threading a new `onDismiss` prop through to
  add a button the toolbar can't otherwise support would touch the call site and
  `annotation-toolbar.stories.tsx` for a control this ticket doesn't need: `StoryText.handleMouseUp`
  (`story-reader.tsx:106-119`) already calls `onSelection(null)` the moment the selection collapses,
  i.e. the instant the user clicks elsewhere or starts a new selection — so the over-limit pill in
  `annotation-toolbar.tsx` clears itself the same way the normal toolbar already does today, with no new
  prop. Its too-long state is therefore message-only, no button at all — not even a matching "dismiss"
  one — while the two popover surfaces keep their existing "Отмена".

This keeps the reject-not-clamp policy AC 3 requires while satisfying the issue's own bar ("the cap
should never surprise a user mid-selection with an opaque rejection") — the surprise point moves from
"after they click Save" to "the instant they finish selecting," with no button reachable in between.

### `selected_text` cap: 2000, reusing #119's established magnitude — not re-derived from scratch

`selected_text` is a passage lifted from AI-generated story or plan text, which runs to several
thousand characters per story (`textFinal`/`planFinal` have no length cap in the schema). The ticket
exists specifically so a legitimate long passage a parent wants to react to isn't rejected — a tight
cap reintroduces the exact harm this ticket was filed to prevent, while a generous cap still bounds the
write against a true accidental whole-page selection. Rather than deriving a new number from an
unmeasured guess at "typical paragraph length," this reuses 2000 — the magnitude #119 already
established in this same codebase for a comparable "freeform passage of user-relevant text feeding a
Postgres text column with no downstream LLM-prompt concatenation limit," and ships on the generous end
per the reasoning above. **`SELECTED_TEXT_MAX_LENGTH = 2000`**, shared by all three surfaces (one
schema field, one cap, regardless of `context: 'plan' | 'text'`).

### `note_text` cap: 2000, not the narrower affordance-based number first considered

`note_text`'s single-line `<input>` (annotation-toolbar.tsx) is a quick reaction tag — genuinely short.
But `text-review.tsx` and `plan-annotator.tsx` use a 2-row `<textarea>` for substantive feedback that
directly drives `redo-text`/`redo-plan` (`stories.ts:704-714` gates `redo-text` on `hasNotes`, i.e. on
this same `note_text` column having content) — a real pipeline dependency, not decoration. Sizing the
cap off the widget (a `rows={2}` textarea "looks like" it wants ~300-500 chars) is an affordance
argument, not evidence, and this is the one number in this ticket that can actively regress an existing
workflow: today these two textareas have no `maxLength` at all, so a parent already writing longer plan/
text feedback succeeds right now and would start failing mid-typing the moment a too-tight cap ships.

**Fact:** no DB access was available in this planning session (no Neon MCP tool loaded, no
production connection) to check the actual distribution of existing `note_text` lengths by `context`,
which is the discriminating evidence for this number. **Assumption, stated explicitly rather than
guessed silently:** absent that data, this reuses #119's already-established 2000-character magnitude
for the same reason `selected_text` does above — the asymmetric risk of guessing wrong runs one
direction only (a too-tight cap breaks a pipeline-feeding workflow silently; a too-generous cap just
under-bounds a field that was fully unbounded before this ticket). **`NOTE_TEXT_MAX_LENGTH = 2000`**,
shared by all three surfaces. **To verify before/during implementation:** query
`select context, max(length(note_text)), percentile_cont(0.95) within group (order by length(note_text))
from annotations group by context` against the production DB; if real lengths cluster well under 2000,
tightening later is a one-line, fully reversible change — nothing else in this spec depends on the exact
number.

### Confirmed: the friendly message actually reaches the user (not just the schema)

Checked, not assumed: `packages/api/src/middleware/validate.ts:9` returns
`{ error: result.error.issues[0]?.message ?? 'Invalid input' }` — the raw Zod issue message, verbatim,
in the response body's `error` field. `packages/web/src/lib/format-api-error.ts:14-16`
(`extractBodyMessage`) reads `body.error` first and returns it as-is. Every one of the three frontend
surfaces' catch blocks (`story-reader.tsx:255`, `text-review.tsx:102`, `plan-annotator.tsx:173`) already
does `err instanceof Error ? err.message : ...`, so a custom Russian `.max()` message on either schema
field surfaces to the parent with no additional wiring, exactly like #119's diary message does today.

### Design decisions made autonomously (recommended-default rule; no genuine architectural fork found)

- **Extract `createAnnotationSchema` out of `stories.ts` into its own module**, mirroring the existing
  `create-story-schema.ts` precedent (imported at `stories.ts:15`) rather than #119's `diary.ts` pattern
  of exporting in place. `diary.ts` is small; `stories.ts` is 1273 lines and imports the DB client,
  every pipeline trigger module, and ~20 other route helpers — a test importing `createAnnotationSchema`
  from `stories.ts` directly would drag all of that in for a pure-function schema test. New file:
  `packages/api/src/routes/create-annotation-schema.ts`, exporting `createAnnotationSchema`;
  `stories.ts` imports it the same way it already imports `createStorySchema`.
- **Shared constants/validators live in `components/`, not `pages/`, matching the existing import
  direction.** `story-reader-annotations.ts` (in `pages/`) already re-exports `annotationTypeLabel` from
  `../components/types` — the established arrow is pages → components. `annotation-toolbar.tsx`
  (components/) and `plan-annotator.tsx` (components/) both need the same constants that
  `story-reader.tsx`/`text-review.tsx` (pages/) need, so the constants belong in a new
  `packages/web/src/components/annotation-limits.ts`, re-exported from `story-reader-annotations.ts` the
  same way `annotationTypeLabel` is — not duplicated per-surface, and not placed somewhere `components/`
  would have to reach into `pages/` to use it.
- **API/web numeric duplication kept, matching #119.** `SELECTED_TEXT_MAX_LENGTH`/`NOTE_TEXT_MAX_LENGTH`
  exist independently in `create-annotation-schema.ts` (2000 for both fields as Zod `.max()` args) and
  `annotation-limits.ts` (as exported constants). #119 did the same for `DIARY_CONTENT_MAX_LENGTH` —
  intentional, not an oversight; `packages/api` and `packages/web` are separate deploy units with no
  shared-constants package in this repo's current architecture.
- **Reject, not truncate, for both fields** — required by AC 3 ("no silent truncation") and consistent
  with the `selected_text` UX decision above.
- **`note_text`'s existing `.optional()` (no `.min(1)`) is left alone.** Only `.max()` is added; an empty
  `note_text` is valid today for reaction-only annotations (`sasha_laughed`/`sasha_loved`/`sasha_disliked`
  send no note text at all — see `annotation-toolbar.tsx:78`), and that's out of scope for this ticket.
- **Counter/`maxLength` added to all three `note_text` inputs**, matching #119's "always visible, raw
  length, not trimmed" pattern (`draft.length` vs `maxLength`, not `draft.trim().length`) for the same
  reason #119 established it: the counter must track what the input widget's own `maxLength` actually
  enforces, or the two visibly disagree.
- **The over-limit `selected_text` state replaces the normal controls, it doesn't just disable a
  button.** A disabled button next to enabled reaction buttons would be inconsistent (reactions have no
  submit gate at all — `onAnnotate(type, selectedText)` fires directly on click in
  `annotation-toolbar.tsx:78`). Swapping the whole control body for a short message when
  `selectedText.length > SELECTED_TEXT_MAX_LENGTH` is the only treatment that closes the gap for
  reaction buttons too, not just the note-save path.

### Files by scenario

| Scenario | Backend files | Frontend files |
|---|---|---|
| S1 — creating an annotation with `note_text` at or under 2000 chars succeeds normally | `create-annotation-schema.ts` | all three surfaces (regression check) |
| S2 — creating an annotation with `selected_text` at or under 2000 chars succeeds normally | `create-annotation-schema.ts` | all three surfaces (regression check) |
| S3 — a request with `note_text` over 2000 chars is rejected with a friendly Russian message, not truncated | `create-annotation-schema.ts` | none (server-side defense-in-depth path) |
| S4 — a request with `selected_text` over 2000 chars is rejected with a friendly Russian message, not truncated | `create-annotation-schema.ts` | none (server-side defense-in-depth path) |
| S5 — typing past 2000 chars in the `note_text` input/textarea is blocked by `maxLength` in all three surfaces, with a visible counter | none | `annotation-toolbar.tsx`, `text-review.tsx`, `plan-annotator.tsx` |
| S6 — selecting more than 2000 chars of story/plan/draft text renders a "selection too long" message in place of the note textarea + Save (and the reaction buttons, in `annotation-toolbar.tsx`), in all three surfaces, with no reachable Save/reaction button; the `Отмена` and `onChatAboutThis`/"Обсудить →" controls stay reachable in `text-review.tsx`/`plan-annotator.tsx` since chatting about a long passage is unaffected by this ticket's cap | none | `annotation-toolbar.tsx`, `text-review.tsx`, `plan-annotator.tsx` |
| S7 — selecting at or under 2000 chars renders the normal toolbar/popover controls unchanged (regression check on the boundary) | none | all three surfaces |

### Data model changes

None. Pure validation/UX, matching #119 and the PM's `type:chore` framing.

### Files to create

```
packages/api/src/routes/create-annotation-schema.ts
  export const createAnnotationSchema = z.object({
    type: z.enum(['sasha_reaction', 'my_note', 'sasha_laughed', 'sasha_loved', 'sasha_disliked']),
    selected_text: z.string().min(1).max(2000, 'Слишком большой фрагмент текста (максимум 2000 символов)').optional(),
    note_text: z.string().max(2000, 'Слишком длинная заметка (максимум 2000 символов)').optional(),
    position_start: z.number().int().nonnegative().optional(),
    position_end: z.number().int().nonnegative().optional(),
    context: z.enum(['plan', 'text']).optional(),
  })
  export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>

packages/api/src/routes/create-annotation-schema.test.ts
  import { createAnnotationSchema } from './create-annotation-schema'
  — accepts a minimal valid payload (regression guard)
  — accepts selected_text at exactly 2000 characters
  — rejects selected_text over 2000 characters
  — rejects-too-long selected_text carries the custom Russian message
  — accepts note_text at exactly 2000 characters
  — rejects note_text over 2000 characters
  — rejects-too-long note_text carries the custom Russian message
  — still accepts a reaction annotation with no note_text at all (sasha_laughed etc., regression guard)

packages/web/src/components/annotation-limits.ts
  export const SELECTED_TEXT_MAX_LENGTH = 2000
  export const NOTE_TEXT_MAX_LENGTH = 2000
  export function isSelectionWithinLimit(text: string): boolean
    return text.length <= SELECTED_TEXT_MAX_LENGTH
  export function isNoteTextWithinLimit(text: string): boolean
    return text.length <= NOTE_TEXT_MAX_LENGTH
  export const SELECTION_TOO_LONG_MESSAGE =
    `Слишком большой фрагмент текста. Выделите отрывок покороче (максимум ${SELECTED_TEXT_MAX_LENGTH} символов).`
    (template literal off the constant, not a hardcoded "2000" — keeps the number a one-line change if
    the cap is ever tightened per the note_text "To verify" item above)

packages/web/src/components/annotation-limits.test.ts
  import { isSelectionWithinLimit, isNoteTextWithinLimit, SELECTED_TEXT_MAX_LENGTH, NOTE_TEXT_MAX_LENGTH } from './annotation-limits'
  — isSelectionWithinLimit: accepts at exactly SELECTED_TEXT_MAX_LENGTH
  — isSelectionWithinLimit: rejects one over SELECTED_TEXT_MAX_LENGTH
  — isNoteTextWithinLimit: accepts at exactly NOTE_TEXT_MAX_LENGTH
  — isNoteTextWithinLimit: rejects one over NOTE_TEXT_MAX_LENGTH
```

### Files to modify

```
packages/api/src/routes/stories.ts
  - remove the inline `const createAnnotationSchema = z.object({...})` (lines 89-96)
  + import { createAnnotationSchema } from './create-annotation-schema'
  (route handler at line 792 is unchanged — same schema shape, same field names)

packages/web/src/pages/story-reader-annotations.ts
  + export { SELECTED_TEXT_MAX_LENGTH, NOTE_TEXT_MAX_LENGTH, isSelectionWithinLimit, isNoteTextWithinLimit, SELECTION_TOO_LONG_MESSAGE } from '../components/annotation-limits'
    (same re-export pattern already used for annotationTypeLabel on line 3)

packages/web/src/components/annotation-toolbar.tsx
  + import { NOTE_TEXT_MAX_LENGTH, SELECTED_TEXT_MAX_LENGTH, isSelectionWithinLimit, isNoteTextWithinLimit, SELECTION_TOO_LONG_MESSAGE } from './annotation-limits'
  + the `!isSelectionWithinLimit(selectedText)` check must sit ABOVE the existing `if (noteMode)` branch
    (line 21), not below it — otherwise an over-limit selection that already entered note mode (e.g. the
    selection grew after clicking "Заметка" but before this ticket, not reachable pre-ticket but worth
    getting the ordering right regardless) would still render the normal note input instead of the
    too-long message. Order: `if (!selectedText) return null` → too-long check → `if (noteMode)` → normal.
  + render the too-long pill instead of the normal reaction/note controls: same outer pill styling,
    SELECTION_TOO_LONG_MESSAGE text only, no button (no onAnnotate path reachable; no dismiss button
    either — see the asymmetry note in the UX decision above, `onSelection(null)` from the parent's
    `handleMouseUp` already clears it, no new prop needed)
  note input: + maxLength={NOTE_TEXT_MAX_LENGTH}, + a small counter (e.g. `{noteText.length}/{NOTE_TEXT_MAX_LENGTH}`)
    next to the existing Сохранить/✕ buttons
  Сохранить button disabled predicate: `!noteText.trim()` → `!noteText.trim() || !isNoteTextWithinLimit(noteText)`
    (defense in depth — maxLength already blocks reaching this state through typing, same as #119)

packages/web/src/pages/text-review.tsx (TextAnnotationPanel)
  + import from '../components/annotation-limits'
  popover body: if (!isSelectionWithinLimit(popover.text)) render SELECTION_TOO_LONG_MESSAGE in place of
    ONLY the comment textarea + Save button. Keep both Отмена AND the `onChatAboutThis` secondary button
    (when present) rendered as-is — chatting about a long passage is unaffected by this ticket (it goes
    through `sendMessageSchema` in `pipeline-questions.ts`, which this ticket does not touch and does not
    cap), so removing that button here would be an unrelated regression, not a consequence of this cap.
  comment textarea: + maxLength={NOTE_TEXT_MAX_LENGTH}, + counter
  handleSave guard: `if (!popover || !comment.trim())` → also require `isNoteTextWithinLimit(comment)`
    (defense in depth)

packages/web/src/components/plan-annotator.tsx (PlanAnnotator)
  + import from './annotation-limits'
  popover body: same too-long swap as text-review.tsx — comment textarea + Save only, keep Отмена and
    `onChatAboutThis` (if applicable in this component's props) rendered
  comment textarea: + maxLength={NOTE_TEXT_MAX_LENGTH}, + counter
  handleSave guard: same defense-in-depth addition as text-review.tsx
```

### Implementation order

1. `create-annotation-schema.ts`: new file, extracted schema + `.max()` on both fields with Russian messages.
2. `create-annotation-schema.test.ts`: boundary + message tests against the real exported schema.
3. `stories.ts`: swap inline schema for the import; confirm `npx tsc --noEmit` still clean (no behavior change here).
4. `annotation-limits.ts` + `annotation-limits.test.ts`: constants + pure predicates, tested standalone.
5. `story-reader-annotations.ts`: re-export addition (one line, no logic).
6. `annotation-toolbar.tsx`: too-long swap + `maxLength`/counter on the note input.
7. `text-review.tsx`: same treatment for its popover.
8. `plan-annotator.tsx`: same treatment for its popover.
9. Manual check in local dev: confirm all three surfaces block/warn consistently at the boundary.

### Definition of Done — per layer

**Backend:** `npx vitest run packages/api/src/routes/create-annotation-schema.test.ts` passes, including
both boundary cases and both custom-message assertions. `npx tsc --noEmit` clean.

**Frontend:** `npx vitest run packages/web/src/components/annotation-limits.test.ts` passes. `npx tsc
--noEmit` clean. Manual check (`npm run docker:up`): in each of the three surfaces (story reader, text
review, plan review) — typing a note past 2000 characters stops accepting input with a visible counter;
selecting a passage over ~2000 characters swaps the toolbar/popover for the Russian too-long message with
no reachable Save/reaction control; a direct `POST /api/stories/:id/annotations` with an over-limit field
(e.g. via curl) returns the friendly message in its JSON `error` field, not a 500 or truncated write.

**Infrastructure:** none — no migration, no new endpoint, no deploy-time concern beyond the normal
push-to-`main` pipeline.

### Scope boundary

Out of scope for this task:
- Any change to `position_start`/`position_end`/`context` fields — unaffected by this ticket.
- Live length feedback during the selection drag itself (option A above) — deliberately rejected, not
  deferred; see the UX decision section for reasoning.
- A shared `packages/shared`-level constant for the numeric caps — the API/web duplication is
  intentional, matching #119's precedent, not a gap to close later.
- Retroactively validating or flagging any pre-existing annotation row already over either cap — the cap
  is write-time only (`POST`), matching #119's "cap applies to new writes only" decision. `GET` reads
  are untouched.
- `annotation-toolbar.stories.tsx` (existing Storybook stories: `Visible`, `Empty`, `WithLongText`) —
  no new story added for the over-limit pill state. Flagged explicitly rather than left unmentioned:
  the too-long swap is a small, directly-inspectable conditional render (`selectedText.length >
  SELECTED_TEXT_MAX_LENGTH`), and adding a `TooLong` story is a genuinely optional nice-to-have, not a
  correctness gap — the two vitest suites plus the manual local-dev check in the Definition of Done
  already exercise the actual behavior.
- **A found, out-of-scope server-side write path that bypasses `createAnnotationSchema` entirely,
  flagged as a fact the same way #119 flagged `story-analysis.ts`'s direct `childDiary` insert:**
  `packages/api/src/routes/pipeline-questions.ts:246-254` (the story-chat "send message" endpoint) banks
  an unselected chat message directly as an annotation — `db.insert(annotations).values({ ...,
  noteText: message, ... })` — when the user sends a chat message with no text selection. `message`
  comes from `sendMessageSchema` (`pipeline-questions.ts:201`), which is `z.string().min(1)` with **no
  `.max()` at all** — this ticket's `createAnnotationSchema` cap has zero effect on this path since the
  insert never goes through that schema. This is a real, correctly-flagged instance of the same
  underlying gap (unbounded freeform text reaching an `annotations` row), just not this ticket's own
  acceptance criteria — the issue and this spec are both scoped to `createAnnotationSchema`/`POST
  /:id/annotations` specifically. Recommended as a further fast-follow, not folded in here.

### Risk/effort verdict

**Low-to-medium risk, one day of effort — larger than #119 but still squarely inside the `type:chore`
1-3 day band.** The size difference from #119 is entirely due to a fact the issue body didn't know:
three independent frontend components share the one schema, not one. Each backend change is a direct,
low-risk copy of #119's pattern (schema extraction adds a touch more surface area than #119's in-place
export, but follows an existing precedent — `create-story-schema.ts` — rather than inventing a new one).
The one place with genuine design latitude is the `selected_text` UX treatment itself, resolved above by
reusing the render-moment-of-the-existing-toolbar rather than building new selection-tracking machinery;
that's the analysis this ticket exists to do, not a shortcut. No migration, no new endpoint, no
architectural fork — three repeated instances of the same small pattern, not three different designs.
