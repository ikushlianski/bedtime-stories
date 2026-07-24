---
type: scenarios
branch: interactive-story-chat
task: Interactive story chat — accumulate-then-generate creation flow, plus diff view on patch proposals
state: confirmed
updated: 2026-07-24
---
# Scenarios: Interactive story chat

## Business Scenarios

### Group A — Telegram: accumulate-then-generate

SCENARIO A1: Multiple messages accumulate without firing the pipeline

After picking a universe via `/new`, the parent sends three separate plain-text messages describing the idea before finalizing. None of them create a story.

What to verify:
- [x] Each message is appended to the pending action's accumulated seed, not treated as a finished idea. `packages/api/src/routes/telegram.ts:404-407` (`peekPendingAction` + `appendPendingSeedText`); pure append logic `packages/api/src/routes/telegram-pending-action.ts:30-38` (`appendToAccumulatedSeed`), unit-tested `packages/api/src/routes/telegram-pending-action.test.ts:28-50`; controller-level assertion `telegram-new-flow.test.ts:197-212` and `:214-222` (second message appends onto the first).
- [x] No `stories` row is inserted and no pipeline dispatch happens after any of the three messages. `packages/api/src/routes/telegram.ts:406-412` returns before reaching `createStoryAndFire`/`createStoryForUniverse`; asserted `packages/api/src/routes/telegram-new-flow.test.ts:205` (`expect(dbState.insertedStory).toBeUndefined()`).
- [x] Each message gets an acknowledgement reply with a "✅ Готово" button. `packages/api/src/routes/telegram.ts:408-410`; asserted `packages/api/src/routes/telegram-new-flow.test.ts:207-211`.

SCENARIO A2: Tapping "Готово" finalizes with everything accumulated

After sending several messages (A1), the parent taps the "✅ Готово" inline button.

What to verify:
- [x] The pipeline fires exactly once, with a seed containing all accumulated messages (not just the last one). `packages/api/src/routes/telegram.ts:381-389` (`newgo` callback → `finalizePendingStory`), `:126-142` (`finalizePendingStory` passes `pending.accumulatedSeed` to `createStoryForUniverse`); asserted `packages/api/src/routes/telegram-new-flow.test.ts:224-237`.
- [x] The pending action row is cleared after finalizing. `packages/api/src/routes/telegram-pending-action.ts:86-101` (`consumePendingAction` deletes via `db.delete(...).returning()`), called at `telegram.ts:127`.
- [x] The reply names the new story id, matching today's wording. `packages/api/src/routes/telegram.ts:142`; asserted `packages/api/src/routes/telegram-new-flow.test.ts:235-236`.

SCENARIO A3: `/go` command finalizes the same way as the button

Instead of tapping the button, the parent types `/go`.

What to verify:
- [x] Same outcome as A2 — `/go` and the "Готово" button are two triggers for the identical finalize path. `packages/api/src/routes/telegram.ts:391-395` (`bot.command('go', ...)`) calls the same `finalizePendingStory` as the `newgo` callback; asserted `packages/api/src/routes/telegram-new-flow.test.ts:239-249`.

SCENARIO A4: Finalizing with nothing accumulated yet is a no-op

The parent picks a universe, then immediately taps "Готово" (or sends `/go`) without ever sending an idea message.

What to verify:
- [x] No story is created, no pipeline dispatch happens. `packages/api/src/routes/telegram.ts:134-138` early-returns before `createStoryForUniverse`; asserted `packages/api/src/routes/telegram-new-flow.test.ts:251-262` (`expect(dbState.insertedStory).toBeUndefined()` at line 257).
- [x] The pending action row is NOT deleted — the parent can still send an idea afterward. `packages/api/src/routes/telegram.ts:135` re-inserts via `setPendingUniverseChoice` after `consumePendingAction` deleted it; asserted `telegram-new-flow.test.ts:258` (`setPendingUniverseChoice` called with the same chat/universe).
- [x] The reply asks the parent to describe the idea first. `packages/api/src/routes/telegram.ts:136`; asserted `telegram-new-flow.test.ts:260-261`.

SCENARIO A5: A stale pending action does not hijack a later, unrelated message

The parent picks a universe, then goes quiet for longer than the 30-minute TTL, then sends a plain-text message unrelated to story creation (e.g. a bare story id).

What to verify:
- [x] The expired pending action is treated as absent — the message runs today's normal path unchanged. `packages/api/src/routes/telegram-pending-action.ts:56-69` (`peekPendingAction` deletes and returns `null` when `isPendingActionExpired` is true), consumed at `telegram.ts:404-406` (falls through to `parseStoryIdMessage`/`createStoryAndFire` when `pending === null`); the "no pending action" path is exercised by `telegram-new-flow.test.ts:184-195`, and the underlying TTL boundary is pure-tested in `telegram-pending-action.test.ts:66-87` (pre-existing `isPendingActionExpired` tests, unchanged contract).
- [x] Sending an idea message before the TTL lapses keeps the timer alive. `packages/api/src/routes/telegram-pending-action.ts:78-81` (`appendPendingSeedText` sets `createdAt: new Date()` on every append).

SCENARIO A6: No pending action — today's behavior is untouched

A plain-text message arrives in a chat that never ran `/new` (or already finalized/expired). It is looked up as a story id, or falls back to `createStoryAndFire` against the default universe.

What to verify:
- [x] Byte-for-byte the same behavior as before this change. `packages/api/src/routes/telegram.ts:414-428` — the id-lookup/`createStoryAndFire` branch is untouched from the pre-existing implementation; regression-pinned by `packages/api/src/routes/telegram-new-flow.test.ts:184-195` (numeric-looking text still runs id lookup when no pending action) and `packages/api/src/routes/telegram.test.ts` (12 tests, all passing).

## Group B — Web: accumulate-then-generate

SCENARIO B1: Multiple context messages accumulate before submitting

In the create-story modal, the parent types a note, clicks "Добавить", repeats twice more, and only then clicks "Создать историю".

What to verify:
- [x] Each added note appears in a visible list of accumulated context before submission. `packages/web/src/components/create-story-modal.tsx:90-97` (`addContextMessage`), rendered `:264-283`.
- [x] The submitted seed contains all accumulated notes, not just the last one. `packages/web/src/components/create-story-modal.tsx:103-105` (`handleSubmit` builds `seed` via `buildAccumulatedSeed(contextMessages, form.seed)`); pure join logic `packages/web/src/components/create-story-form.ts` `buildAccumulatedSeed`, unit-tested `packages/web/src/components/create-story-form.test.ts:73-77` (joins multiple messages).
- [x] Submission is blocked until there is at least one non-empty note or draft. `packages/web/src/components/create-story-modal.tsx:179-180` (`canSubmit` re-validates the accumulated seed via `validateCreateStoryForm`); empty-seed rejection unit-tested `create-story-form.test.ts:25-29` and the accumulator's empty-result case `create-story-form.test.ts:98-100`.

SCENARIO B2: A mistaken note can be removed before submitting

The parent adds two notes, then removes the first one before submitting.

What to verify:
- [x] The removed note is excluded from the submitted seed. `packages/web/src/components/create-story-modal.tsx:99-101` (`removeContextMessage` filters the array by index), feeding the same `buildAccumulatedSeed` call used at submit time.
- [x] Removing the only note returns the form to its "nothing accumulated yet" state. `packages/web/src/components/create-story-form.ts` `buildAccumulatedSeed([], '')` returns `''`, unit-tested `create-story-form.test.ts:98-100`; `canSubmit` (`create-story-modal.tsx:179-180`) then falls back to whatever the draft field holds, matching the "draft alone" case tested `create-story-form.test.ts:87-89`.

SCENARIO B3: Typing directly and submitting without clicking "Добавить" still works

The parent types a single idea in the draft field and clicks "Создать историю" directly, never clicking "Добавить".

What to verify:
- [x] The typed draft is folded into the submitted seed exactly as if it had been added first. `packages/web/src/components/create-story-modal.tsx:103-105` calls `buildAccumulatedSeed(contextMessages, form.seed)` with the untouched draft text as the second argument even when `contextMessages` is empty; unit-tested `packages/web/src/components/create-story-form.test.ts:87-89` (`buildAccumulatedSeed([], 'Единственная идея')`).

## Group C — Diff view on patch proposals

SCENARIO C1: A proposed patch renders as a diff against the original

The parent selects a passage and asks for a rewrite; the assistant proposes a `<<<PATCH>>>` replacement. The panel is showing the proposed change.

What to verify:
- [x] Unchanged wording, the removed original wording, and the added new wording are each visually distinguishable. `packages/web/src/pages/story-chat-panel.tsx:192-197` renders `<PatchDiffView original={selectedText} patched={parsed.patch} />`; classification logic `packages/web/src/lib/compute-patch-diff.ts` (`computePatchDiff`, `diffWords` with a Russian `Intl.Segmenter` — plain `diffWords` was verified broken for Cyrillic during TDD, see `compute-patch-diff.test.ts`), unit-tested `packages/web/src/lib/compute-patch-diff.test.ts:1-49` (6 tests covering unchanged/added/removed/replacement/empty-original); DOM-level distinguishability (distinct classes per segment type) asserted `packages/web/src/components/patch-diff-view.test.tsx:16-30`.
- [x] The one-line summary and the "Применить" (Apply) button still render exactly as before. `packages/web/src/pages/story-chat-panel.tsx:198-206` — `parsed.summary` and the Apply button markup are unchanged from before this feature, only the patch-text block above them (previously `<p>{parsed.patch}</p>`) was replaced.

SCENARIO C2: Applying the patch after viewing the diff behaves exactly as before

The parent reviews the diff from C1 and clicks "Применить".

What to verify:
- [x] The same `applyPlanPatch` / `applyTextPatch` call fires with the same `{ find, replace, summary }` payload as before this change. `packages/web/src/pages/story-chat-panel.tsx:116-137` (`handleApplyPatch`) is byte-for-byte unchanged — still reads `selectedText`/`pendingPatch.patch`/`pendingPatch.summary` directly, never touches `computePatchDiff`'s output.

## Technical/Architectural Scenarios

SCENARIO T1: Adding the accumulation column does not disturb an in-flight pending action

A migration adds a nullable `accumulated_seed` column to `telegram_pending_actions`. Any pending action row that existed before the migration (universe chosen, no accumulation logic yet) must still be consumable.

What to verify:
- [x] The migration is additive and idempotent (`ADD COLUMN IF NOT EXISTS`), matching this repo's established migration convention. `packages/core/src/db/migrations/0044_loving_lyja.sql:1`; schema source `packages/core/src/db/schema.ts` `telegramPendingActions.accumulatedSeed` (nullable `text`). Applied to the disposable dev branch via `npm run db:migrate` and confirmed via a live `information_schema.columns` query (`accumulated_seed | text | YES`).
- [x] A pre-existing row with `accumulated_seed` absent (NULL) is treated as "no idea text yet." `packages/api/src/routes/telegram-pending-action.ts:30-38` (`appendToAccumulatedSeed(null, next)` returns `next` as-is) and `:40-42` (`isReadyToFinalize(null)` returns `false`) — both pure-tested for the `null` case, `telegram-pending-action.test.ts:29-31` and `:53-55`.

SCENARIO T2: New component-test environment does not break existing tests

`packages/web` gains its first component test, requiring a jsdom test environment. Every other package continues running under the existing node environment.

What to verify:
- [x] `npx vitest run` still passes for all pre-existing test files after the environment change. `vitest.config.ts:12-14` (`environmentMatchGlobs: [['packages/web/**', 'jsdom']]`, scoped so non-web packages keep the default `node` environment). Full run: 72 test files, 515 tests, all passing (see verification log below).
