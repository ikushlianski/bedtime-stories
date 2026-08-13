---
type: spec
branch: main
task: Cap diary entry length in validation and the diary UI so a parent gets a clear friendly warning before saving, instead of an unbounded write or a confusing server error (GH #119)
complexity: simple
state: confirmed
updated: 2026-08-13
---
# Spec: Diary entry length validation

### Why

The issue's own text: "As a parent who sometimes writes detailed diary observations about Gosha,
the app reliably saves my entry without silently truncating it or failing with a confusing error
— and if my note is genuinely too long, I see a clear friendly message telling me before I try to
save." Two acceptance criteria: (1) no silent truncation or confusing server failure, (2) a clear
friendly message shown *before* save is attempted, not just after a rejected request. `Enables:`
ties this directly to #101 (diary observations personalizing the next story) — the issue's own
framing is that unbounded/failing diary writes undermine that pipeline dependency, not just an
abstract data-integrity concern.

Verified against current code (matches the PM's triage note): `packages/api/src/routes/diary.ts:11`'s
`createDiarySchema` is `content: z.string().min(1)` — no `.max()`. `packages/web/src/pages/diary.tsx`
has no `maxLength` on its textarea (line 63) and no character counter; the only guard anywhere is
`draft.trim().length === 0` (lines 27, 71) — a non-empty check, not a length ceiling.

### Character limit: 2000, decided by downstream consumption, not by field-name analogy

The codebase's `.max()` precedents split into two families: short pipeline-adjacent notes (`fragments.text`,
`words.hint`, `topics.note` — all 2000) and one large single-shot authorial input (`seed`/`outline` — 5000).
Diary entries could plausibly be argued either way by analogy alone, so the deciding fact is how diary
content is actually consumed downstream, checked directly rather than assumed:

- `packages/core/src/pipeline/feedback-synthesizer.ts:13` pulls the **10 most recent** `childDiary` rows
  (`.limit(10)`) into the story-synthesis prompt.
- `packages/core/src/pipeline/synthesizer-prompt-builder.ts:179-183` concatenates all of them verbatim
  under a `[ВЕС 0.6] ДНЕВНИКОВЫЕ ЗАПИСИ` section, one entry per line, no per-entry truncation.

This means the real budget is **per-entry cap × 10**, not a single field's size. At 2000 chars/entry that's
a 20,000-char (~5k token) worst case contribution to the synthesis prompt — bounded and consistent with
this codebase's existing caution around freeform parent text feeding the pipeline: `.planning/LOG.md`'s
2026-07-25 entry records a 4000-char accumulation cap added to `appendPendingSeedText` for exactly this
class of risk (unbounded freeform parent text heading into an LLM prompt), and that cap was for a *single*
accumulating field, not ten. 2000/entry keeps the aggregate in the same conservative range. 5000 would
make the aggregate 50,000 chars for one signal among several in the same prompt — no evidence that's
needed, and it cuts against the codebase's own established caution here. **Decision: `.max(2000)`.**

One more consumption path found, out of scope but worth flagging: `packages/api/src/routes/story-analysis.ts:60-64`
also writes to `childDiary` directly via `db.insert(childDiary).values(...)`, bypassing the
`POST /api/diary` route and its schema entirely (AI-extracted reaction quotes, not user input). This
task's `.max()` on `createDiarySchema` has no effect on that path — noted so nobody assumes it does;
not a risk worth acting on here since the inserted text is a short formatted quote, not user-typed length.

### Scope: annotation fields (`note_text`, `selected_text`) are OUT of scope for this ticket

The issue title ("[Task] Diary Entry Length Validation"), user story, and `Enables`/`Depends on` lines
are diary-specific throughout. The PM's triage comment's "Priority rationale" also names
`createAnnotationSchema`'s `note_text`/`selected_text` (`packages/api/src/routes/stories.ts:92-93`,
confirmed still `.min(1)`/no `.max()` on both) — but that's stated as *rationale for priority*
("annotation text... are currently uncapped... can cause unexpected server failures"), not as an
acceptance criterion of this specific task. It is not silently dropped: it's a real, correctly-flagged
instance of the same underlying gap, just not what this ticket's own title and user story commit to
delivering.

The substantive reason to treat it as separate work, not just ticket pedantry: `note_text` and
`selected_text` are structurally different from a diary textarea. `note_text` is typed through a
single-line `<input>` in `annotation-toolbar.tsx` (short, low risk to cap). `selected_text` is a
**live browser text selection** over AI-generated story text (`annotation-toolbar.tsx:19,78`) — the
user doesn't type it, they select it, and nothing today shows them a running length while selecting.
Adding a bare `.max()` there with no companion UI means a parent who selects a long passage (or a
whole-page selection) gets a rejected annotation with a raw Zod error and no counter to explain why —
a UX regression, not a one-line freebie. That companion UI (a selection-length indicator, and a
clamp-or-truncate decision for `selected_text` specifically, since it can't reuse "disable the save
button" the way a typed textarea can) is real, separate design work.

**Recommended as a fast-follow ticket**, not folded in here: `note_text` capped short (e.g. 500,
matching its single-line input), `selected_text` needs its own UX decision before a numeric cap is
chosen, not a bare reject.

### Design decisions made autonomously

- **Custom Russian error message on `.max()`, deviating from this codebase's existing bare-`.max(2000)`
  convention** (`fragments.ts`, `topics.ts`, `words.ts` all pass no message). Justified, not a shortcut:
  the issue's own acceptance criterion is "a clear friendly message," and `packages/api/src/middleware/validate.ts:9`
  returns `result.error.issues[0]?.message` as the HTTP error body, which `packages/web/src/lib/format-api-error.ts:14-16`
  surfaces verbatim as `err.message` in `diary.tsx`'s catch block. Without a custom message, a rare
  server-side rejection (e.g. a client bypassing the browser's `maxLength`) would show zod's default
  English text in a fully Russian-localized UI. Zod version confirmed: root `package.json` pins `zod: ^4.3.6`,
  installed `4.4.1`; the string-shorthand `.max(n, 'message')` form used here is valid in both v3 (used by
  `packages/web`) and v4 (used by `packages/api`/`packages/core`), so no version-specific API branching
  is needed.
- **Two different measurements, matched to what each one enforces — not one value everywhere.** The
  textarea's `maxLength={2000}` enforces **raw** `draft.length` (that's what the browser actually
  compares against as the user types). The counter must therefore also measure `draft.length`, not
  `draft.trim().length` — if the counter showed the trimmed count, a draft ending in trailing
  whitespace could read e.g. `1998 / 2000` while the textarea silently refuses further input, a
  visible "the counter says there's room but typing does nothing" bug. `isDiaryDraftValid`, by
  contrast, correctly keeps `trim()`: it governs the empty-check and mirrors what `handleSave`
  actually sends and what the server actually validates. With `maxLength` in place as the browser-side
  enforcement point, `isDiaryDraftValid`'s too-long branch is unreachable through normal typing in the
  UI — it exists as defense in depth for programmatic/paste/bypass paths (e.g. pasting text that
  briefly exceeds the cap before React re-renders, or a direct API call), which is exactly why it's
  still asserted in `diary.test.ts` even though the UI itself can't reach that branch through typing.
- **Reject, not truncate**, matching the issue's explicit "without silently truncating it." No text
  segmentation concern applies here (unlike the `Intl.Segmenter` fix noted in `.planning/LOG.md` for
  sentence-boundary splitting) — this is a flat `String.length` compare on both browser `maxLength` and
  Zod `.max()`, so client and server always agree on what counts as "too long."
- **Cap applies to new writes only.** Any pre-existing diary row already longer than 2000 chars (none
  currently expected, but not proven absent without a live DB query) continues to render normally on
  `GET /api/diary` — `.max()` on `createDiarySchema` only gates the `POST` body.
- **Counter is always visible**, not only near the limit — matches the issue's "before I try to save"
  framing (the parent should see the ceiling from the start of typing, not discover it late) and is a
  simpler, less state-driven UI than a proximity-triggered counter.
- **No inline-edit surface to touch.** `diary.tsx` only has create + delete (no `editingId`/`editText`
  state, unlike `fragments.tsx`'s edit-in-place pattern) — the textarea `maxLength` and counter only need
  adding to the single create textarea, not a second edit textarea.
- **`createDiarySchema` is exported**, not left as an unexported `const` (current state). This lets the
  backend test import and exercise the real route schema directly, rather than the anti-pattern seen in
  `stories-vfm.test.ts` (which redeclares an inline copy of the schema — a test like that would still
  pass even if `.max()` were missing from `diary.ts` itself, testing nothing about the actual route).
  `create-story-schema.test.ts` is the correct precedent to follow instead: it imports the real exported
  schema from the route module.

### Files by scenario

| Scenario | Backend files | Frontend files |
|----------|---------------|-----------------|
| SCENARIO 1 — saving a diary entry at or under 2000 characters succeeds normally | `packages/api/src/routes/diary.ts` | `packages/web/src/pages/diary.tsx` |
| SCENARIO 2 — typing past 2000 characters is blocked by the textarea itself (browser `maxLength`), never reaching the save button in an over-limit state | none | `packages/web/src/pages/diary.tsx` |
| SCENARIO 3 — a request that somehow exceeds 2000 characters (e.g. bypassing the browser, direct API call) is rejected with a clear Russian message, not a generic 500 or raw Zod text | `packages/api/src/routes/diary.ts` | `packages/web/src/pages/diary.tsx` (renders the surfaced message via existing `StatusCallout` error path) |
| SCENARIO 4 — the character counter is visible from the start of typing and reflects the same raw length the textarea's `maxLength` enforces (never disagrees with what typing does) | none | `packages/web/src/pages/diary.tsx` |
| SCENARIO 5 — a pre-existing diary entry longer than 2000 characters (if any) still renders fine on the list — the cap never applies retroactively | none (GET is untouched) | `packages/web/src/pages/diary.tsx` (no change needed to the render path — verify only) |

### Data model changes

None. Pure validation/UX — no column, no migration, matching the PM's own note.

### Files to modify

```
packages/api/src/routes/diary.ts
  - const createDiarySchema  →  export const createDiarySchema
  - content: z.string().min(1)
    →  content: z.string().min(1).max(2000, 'Слишком длинная запись (максимум 2000 символов)')

packages/web/src/pages/diary.tsx
  + export const DIARY_CONTENT_MAX_LENGTH = 2000
  + export function isDiaryDraftValid(draft: string): boolean
      const trimmed = draft.trim()
      return trimmed.length > 0 && trimmed.length <= DIARY_CONTENT_MAX_LENGTH
  handleSave: `if (draft.trim().length === 0) return` → `if (!isDiaryDraftValid(draft)) return`
  save button disabled predicate: `saving || draft.trim().length === 0` → `saving || !isDiaryDraftValid(draft)`
  textarea: + `maxLength={DIARY_CONTENT_MAX_LENGTH}`
  save-button row: `<div className="mt-3 flex justify-end">` → `<div className="mt-3 flex items-center justify-between">`
    (currently holds only the button, right-aligned via `justify-end`; adding a left-side counter
    without this change would push both elements against the right edge)
  + a counter element in that row, before the button (matching this file's existing
    `text-xs text-base-content/50` timestamp style). Measures raw `draft.length` — the same value
    `maxLength` enforces, not the trimmed value `isDiaryDraftValid` checks (see design decision above):
      <span className="text-xs text-base-content/50">
        {draft.length} / {DIARY_CONTENT_MAX_LENGTH}
      </span>
  error rendering: no change — the existing `catch (err) { setError(err instanceof Error ? err.message : ...) }`
    → `StatusCallout` path already surfaces the new server-side message verbatim once the schema change lands
```

### Files to create

```
packages/api/src/routes/diary.test.ts
  import { createDiarySchema } from './diary'
  — rejects empty content (existing behavior, regression guard)
  — rejects content over 2000 characters
  — accepts content at exactly 2000 characters (boundary)
  — accepts normal content
  — rejected-too-long result carries the custom Russian message, not zod's default English text

packages/web/src/pages/diary.test.ts
  import { isDiaryDraftValid, DIARY_CONTENT_MAX_LENGTH } from './diary'
  — rejects an empty draft
  — rejects a whitespace-only draft
  — accepts a normal draft
  — accepts a draft whose trimmed length is exactly DIARY_CONTENT_MAX_LENGTH (boundary)
  — rejects a draft whose trimmed length exceeds DIARY_CONTENT_MAX_LENGTH by one
```

### Implementation order

1. `diary.ts`: export the schema, add `.max()` with the custom message.
2. `diary.test.ts`: boundary + message tests against the real exported schema.
3. `diary.tsx`: constant + pure predicate, wired into `handleSave` and the disable predicate.
4. `diary.test.ts` (web): boundary tests against the pure predicate.
5. `diary.tsx`: `maxLength` attribute + counter element (no new logic, pure JSX addition).

### Definition of Done — per layer

**Backend:** `npx vitest run packages/api/src/routes/diary.test.ts` passes, including the boundary
case and the custom-message assertion. `npx tsc --noEmit` clean.

**Frontend:** `npx vitest run packages/web/src/pages/diary.test.ts` passes, including the boundary
case. `npx tsc --noEmit` clean. Manual check in local dev (`npm run docker:up`): typing past 2000
characters stops accepting input in the textarea; the counter is visible and updates live; a direct
`POST /api/diary` with >2000 chars (e.g. via curl, bypassing the browser) returns the friendly Russian
message in its JSON `error` field.

**Infrastructure:** none — no migration, no new endpoint, no deploy-time concern beyond the normal
push-to-`main` pipeline.

### Scope boundary

Out of scope for this task:
- `createAnnotationSchema`'s `note_text`/`selected_text` (`packages/api/src/routes/stories.ts:92-93`) —
  see "Scope: annotation fields are OUT of scope" above for the full reasoning and recommended follow-up
  caps.
- The AI-driven `db.insert(childDiary)` write in `story-analysis.ts:60-64`, which bypasses this ticket's
  schema entirely — flagged as a fact, not treated as a gap this ticket needs to close.
- Any change to the diary list/delete endpoints (`GET /api/diary`, `DELETE /api/diary/:id`) — both are
  read/delete paths with no length concern.
- Retroactively validating or truncating any pre-existing over-length diary row — the cap is write-time
  only, per the "Cap applies to new writes only" decision above.

### Risk/effort verdict

**Low risk, small effort — half a day, not the "1-3 days" the `type:chore` label's own description
implies** (that figure is the label's generic band, not a derived estimate — the actual diff here is
one schema line + export, one pure predicate + constant, one counter span + `maxLength` attribute, and
two narrowly-scoped test files). The one place with genuine latitude, worth naming plainly rather than
waving through: this introduces the **first character-counter UI pattern in `packages/web`** (`grep -rn
maxLength packages/web/src` returns nothing today) — the shape here (always-visible counter, trimmed-length
measurement, reject-not-truncate) is being originated by this task, not copied from an existing sibling.
Everything else — the `.max()` addition, the boundary tests, the disable-predicate wiring — directly
mirrors patterns already live elsewhere in this codebase (`fragments.ts`, `create-story-schema.test.ts`).
No migration, no new endpoint, no architectural fork.
