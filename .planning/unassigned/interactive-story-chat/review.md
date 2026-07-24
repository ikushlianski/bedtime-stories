---
type: review
branch: interactive-story-chat
task: Interactive story chat — accumulate-then-generate creation flow, plus diff view on patch proposals
state: approved
updated: 2026-07-24
---
# Review: Interactive story chat

## Deferred items audit

Scanned `spec.md` "Scope boundary" and "Decisions made autonomously" for anything explicitly held back.

```
DEFERRED: Any AI/LLM involvement in the pre-generation accumulation step (Telegram or web)
Source: spec.md "Scope boundary"
Estimated reason: scope — task asked for message accumulation, not a second AI chat surface
Still deferred? Yes — confirmed no LLM call anywhere in the accumulate/append/finalize path (Telegram or web)

DEFERRED: Editing or reordering accumulated messages in Telegram
Source: spec.md "Scope boundary"
Estimated reason: append-only medium; web gets remove-only, Telegram gets neither, matches the chat medium
Still deferred? Yes — no edit/reorder code found in telegram.ts or telegram-pending-action.ts

DEFERRED: Any change to the already-shipped chat-with-patch mechanism itself (how a patch is generated or applied)
Source: spec.md "Scope boundary"
Estimated reason: this spec only changes how a proposed patch is displayed, not how it's produced or committed
Still deferred? Yes — handleApplyPatch in story-chat-panel.tsx is byte-for-byte unchanged (confirmed independently
  by a second reviewer pass); the proposed replacement text still comes only from the LLM's chat reply, with no
  UI to hand-edit it before applying

DEFERRED: Character/line-level diff toggle or user-configurable diff granularity
Source: spec.md "Scope boundary"
Estimated reason: word-level only, matches the stated Cyrillic-readability requirement
Still deferred? Yes — no toggle, no config option, computePatchDiff is word-level only

DEFERRED: Any change to packages/core pipeline stages, prompts, or dispatchAutoPipeline contract
Source: spec.md "Scope boundary"
Estimated reason: this feature sits entirely above the pipeline (Telegram/web/chat-display), not inside it
Still deferred? Yes — git diff confirms zero files touched under packages/core/src/pipeline/

DEFERRED: Manual Telegram smoke test of the button + /go UX by a real user
Source: todo.md "To review / clarify"
Estimated reason: planned and built as a fully autonomous overnight run, no human available to try it live
Still deferred? Yes — not something a code review can close; needs a real Telegram session
```

Are these deferred items correctly identified? Presenting for confirmation — none of them look like accidentally-dropped scope; all trace to an explicit, reasoned "out of scope" line in spec.md, and the manual-smoke-test item is the one genuinely open action.

## Phase 1: Scenario review

Two independent passes agree on every scenario: my own read of the diff and files, plus a fresh subagent given only `scenarios.md` and `git diff main...HEAD` (no access to spec.md/architecture.md, so it couldn't just trust the plan's own claims about itself).

SCENARIO A1: Multiple messages accumulate without firing the pipeline
  BE [x] Each message appended, not treated as finished idea — `packages/api/src/routes/telegram.ts:404-410`, pure logic `telegram-pending-action.ts:30-38`, unit-tested `telegram-pending-action.test.ts:28-50`, controller-tested `telegram-new-flow.test.ts:197-212`
  BE [x] No story row inserted, no dispatch — `telegram.ts:406-412` returns early; `telegram-new-flow.test.ts:205`
  BE [x] Ack reply with "✅ Готово" button — `telegram.ts:408-410`; `telegram-new-flow.test.ts:207-211`
  FE N/A
  Verdict: PASS

SCENARIO A2: Tapping "Готово" finalizes with everything accumulated
  BE [x] Pipeline fires once with full accumulated seed — `telegram.ts:126-142` (`finalizePendingStory`); `telegram-new-flow.test.ts:224-237`
  BE [x] Pending row cleared — `telegram-pending-action.ts:86-101` (`consumePendingAction`)
  BE [x] Reply names the story id — `telegram.ts:142`
  FE N/A
  Verdict: PASS

SCENARIO A3: `/go` finalizes the same way as the button
  BE [x] Both triggers call the identical `finalizePendingStory` — `telegram.ts:381` (callback), `telegram.ts:391` (`/go` command); `telegram-new-flow.test.ts:239-249`
  FE N/A
  Verdict: PASS

SCENARIO A4: Finalizing with nothing accumulated is a no-op
  BE [x] No story created — `telegram.ts:134-138` early return; `telegram-new-flow.test.ts:251-262`
  BE [x] Pending row survives (re-inserted, not deleted) — `telegram.ts:135`
  BE [x] Reply asks for the idea first — `telegram.ts:136`
  FE N/A
  Verdict: PASS

SCENARIO A5: A stale pending action does not hijack a later message
  BE [x] Expired action treated as absent — `telegram-pending-action.ts:56-69` (`peekPendingAction`); consumed `telegram.ts:404-406`
  BE [x] Sending an idea before TTL lapse resets the timer — `telegram-pending-action.ts:78-81`
  FE N/A
  Verdict: PASS

SCENARIO A6: No pending action — today's behavior is untouched
  BE [x] Id-lookup / default-universe path byte-for-byte unchanged — `telegram.ts:414-428`; regression-pinned `telegram-new-flow.test.ts:184-195` and `telegram.test.ts` (12 tests)
  FE N/A
  Verdict: PASS

SCENARIO B1: Multiple context messages accumulate before submitting
  FE [x] Accumulated list visible before submit — `create-story-modal.tsx:90-97`, rendered `:264-283`
  FE [x] Submitted seed contains all notes — `:103-105` (`buildAccumulatedSeed`); `create-story-form.test.ts:73-77`
  FE [x] Submission blocked until non-empty — `:179-180` (`canSubmit`); `create-story-form.test.ts:26-29`, `:98-100`
  BE N/A
  Verdict: PASS

SCENARIO B2: A mistaken note can be removed before submitting
  FE [x] Removed note excluded — `create-story-modal.tsx:99-101` (`removeContextMessage`)
  FE [x] Removing the only note returns to empty state — `buildAccumulatedSeed([], '')` → `''`; `create-story-form.test.ts:98-100`
  BE N/A
  Verdict: PASS

SCENARIO B3: Typing directly and submitting without "Добавить" still works
  FE [x] Draft folded into submitted seed — `create-story-modal.tsx:103-105`; `create-story-form.test.ts:86-88`
  BE N/A
  Verdict: PASS

SCENARIO C1: A proposed patch renders as a diff against the original
  FE [x] Unchanged/removed/added visually distinguishable — `story-chat-panel.tsx:192-197` (`PatchDiffView`); classification `compute-patch-diff.ts` (`diffWords` + Russian `Intl.Segmenter`), 6 unit tests; DOM-level distinctness (non-empty, differing classNames for added vs. removed) asserted `patch-diff-view.test.tsx:20-35`
  FE [x] Summary and Apply button unchanged — confirmed by diff: only the patch-text block was replaced, summary paragraph and button markup are untouched lines
  BE N/A
  Verdict: PASS

SCENARIO C2: Applying the patch behaves exactly as before
  FE [x] Same `applyPlanPatch`/`applyTextPatch` call, same payload — `handleApplyPatch` (`story-chat-panel.tsx:116-137`) does not appear in the diff at all; confirmed byte-for-byte unchanged
  BE N/A
  Verdict: PASS

SCENARIO T1: Adding the accumulation column does not disturb an in-flight pending action
  BE [x] Additive, idempotent migration — `packages/core/src/db/migrations/0044_loving_lyja.sql:1` (`ADD COLUMN IF NOT EXISTS`); schema `schema.ts:44`
  BE [x] Pre-existing NULL row treated as "no idea yet" — `appendToAccumulatedSeed(null, ...)` and `isReadyToFinalize(null)`, both directly unit-tested
  Infra N/A — no separate infra footprint beyond the SQL/schema pair
  Verdict: PASS

SCENARIO T2: New component-test environment does not break existing tests
  FE [x] `vitest.config.ts:12-14` scopes jsdom to `packages/web/**` only via `environmentMatchGlobs`; full run: 72 files / 515 tests, all passing
  BE N/A
  Verdict: PASS

No MISSING-FROM-PLAN items. The `diff` npm dependency and `package-lock.json` churn are the expected footprint of C1, already covered by that scenario. The pre-existing `line-diff.ts`/`diff-viewer.tsx` (whole-story, line-level diff used elsewhere for v1-vs-v2 comparison) is untouched and is a genuinely different feature at a different granularity — not overlapping scope.

### Self-audit findings
1. Did I tick any box without reading the relevant lines end-to-end? No — every BE/FE citation was opened and read in full, not just grepped.
2. Did I tick any Integration box with only one end cited? N/A — no cross-service integration items in this spec (Telegram/web/DB are each self-contained per scenario).
3. Did I tick any Tests box without confirming the test actually asserts the behavior? No — `compute-patch-diff.test.ts` and `patch-diff-view.test.tsx` were opened and read; both assert real segment classification and real DOM distinguishability, not smoke renders.
4. Did I tick any Observability box? N/A — no observability acceptance items in this spec.
5. Did I assume any behavior was implemented because "it obviously must be"? No — the one place this risk was highest (whether `PatchDiffView` genuinely feeds a working Apply path, or is cosmetic) was checked explicitly by reading `handleApplyPatch` directly; confirmed it still fires the same unchanged API call.
6. Did I mark any layer N/A without confirming there's genuinely no footprint? Yes, checked — e.g. Group A/B have no FE/BE counterpart respectively, confirmed via `git diff --name-only` scoped to each package.

## An important scope clarification (not a defect)

You flagged mid-review that "the chat functionality needs to interactively change stuff." Worth being precise about what this feature does and doesn't do, since it bears directly on that:

- **What's built**: the assistant proposes a patch via chat, and the panel now shows *what changed* — added/removed words highlighted — before the parent clicks Apply. Apply still fires the exact same API call as before this branch.
- **What's not built, and was explicitly out of scope per spec.md**: there is no way to hand-edit the AI's proposed replacement text before applying it. If the parent wants different wording, the only path is to keep chatting and get the assistant to propose a revised patch — the diff view doesn't turn into an editable text box.

If what you actually meant by "interactively change stuff" includes directly tweaking the proposed text yourself (not just seeing it and re-prompting), that's a real, separate feature — worth its own decision on whether it's wanted, not something this review can silently expand scope to cover.

## Phase 2: Architecture review

```
Architecture planned: docs/architecture/interactive-story-chat.md — pending-action state machine gains
  accumulated_seed column and a read/write split (peek/append/consume replacing consumePendingUniverseChoice);
  web create-story-modal gains an accumulation layer in front of the unchanged seed field; a new pure
  diff module inserted between patch-parse and patch-display; first jsdom+RTL test in the repo.
Architecture built: matches exactly — confirmed consumePendingUniverseChoice has zero remaining references
  anywhere in packages/; the three new pending-action functions (peekPendingAction, appendPendingSeedText,
  consumePendingAction) are the only ones telegram.ts now calls; POST /api/stories payload shape (`seed`
  string) is unchanged; PatchDiffView sits between parsePatch and the unchanged apply call.
Infrastructure changes reflected in architecture.md: Yes — the additive nullable-column migration and the
  new jsdom/RTL dev dependencies are both documented under "New infrastructure" / "Data model evolution".
Self-resolved: None needed — no divergence found between plan and diff.
Divergences needing your input: None.
Unplanned changes: None found — every changed file in `git diff main...HEAD --stat` maps to a line in
  spec.md's "Files to create"/"Files to modify" tables.

Does this match your intent?
```

## Phase 3: Code quality

```
Tests: pass (72 files, 515 tests)
Type check: pass (npx tsc --noEmit, zero errors)
Lint: not configured — no eslint.config.js exists on main either; pre-existing repo state, not introduced
  by this branch
Self-resolved: None needed
Needs your input: None
```

## Phase 4: Performance and security

No critical or high severity issues found.

Checked specifically: every Telegram handler (including the new `message:text` accumulation branch,
`newgo` callback, and `/go` command) still runs `deriveIsAuthorizedUser` first, matching the existing
pattern — no new unauthenticated surface. No new HTTP API endpoints were added (`git diff --name-status
-- packages/api/` touches only telegram.ts and telegram-pending-action.ts, both bot-side). No queries
inside loops — `appendPendingSeedText`/`peekPendingAction`/`consumePendingAction` are each single-row
operations keyed by `chat_id`. No sensitive data newly logged. `computePatchDiff` runs synchronously on
short in-memory strings, no perf concern.

## Phase 5: Business feature explainer

ELEMENT: Accumulated context notes (Telegram + web create-story flow)
Possible values:
  Zero notes, draft only: still submittable — falls back to whatever's typed in the single field.
  One or more notes plus optional draft: all get joined together into the final story idea, in the order
    they were added, draft last.
How it's calculated: each note/message is trimmed of blank space; empty ones are silently dropped;
  the rest are joined with a blank line between them (web) or a newline (Telegram) before being handed
  to the story pipeline exactly like a single-message idea always was.
Edge cases: removing every note in the web modal, or never sending a message in Telegram after picking
  a universe, both leave the flow in a safe "waiting for an idea" state rather than erroring or silently
  creating an empty story.

ELEMENT: "✅ Готово" button / `/go` command (Telegram)
Possible values:
  Tapped/sent with accumulated text: creates and starts generating one story from everything accumulated
    so far, then confirms with the new story's number.
  Tapped/sent with nothing accumulated yet: does nothing except remind the parent to describe the idea
    first — the "waiting for an idea" state is preserved so they don't have to restart with /new.
Edge cases: a 30-minute-idle session is treated as expired and any later message goes back to today's
  normal handling (story-id lookup or one-shot creation) rather than silently resuming a stale draft.

ELEMENT: Patch diff view (chat-based story editing)
Possible values:
  Unchanged wording: shown plain.
  Removed wording: shown struck through in red.
  Added wording: shown underlined in green.
How it's calculated: word-level comparison (via a Russian-aware word segmenter, so Cyrillic words don't
  get chopped mid-word) between the currently selected passage and the assistant's proposed replacement.
Edge cases: a complete rewrite of a short passage still renders as one removed block and one added
  block, not an unreadable wall of single-character diffs; this diff is read-only — it shows what would
  change, it does not let the parent type directly into the proposed text (see scope note above).

## Final verdict

review.md → state: approved

Files:
- review.md       — This report.
- scenarios.md    — All acceptance checkboxes confirmed, per-scenario citations verified independently twice.
- spec.md         — Original implementation contract; nothing diverged from it.
- architecture.md — Not present as a separate planning file; docs/architecture/interactive-story-chat.md
  already serves this role, was checked against the diff, and needs no post-implementation brief since
  nothing changed since planning.

Next: /squash-and-rebase-ie or /commit-push
