---
type: spec
branch: interactive-story-chat
task: Interactive story chat — accumulate-then-generate creation flow, plus diff view on patch proposals
complexity: complex
state: confirmed
updated: 2026-07-24
---
# Spec: Interactive story chat

## Origin

No Linear ticket. Planned from a direct engineering brief that already investigated the codebase and
identified two concrete gaps mapping to the user request "the chat should be interactive: accumulate
context, patch text in-place, show the diff." Written to `.planning/unassigned/interactive-story-chat/`
per the constitution's no-ticket rule.

### Implementation Phases

| Phase | Scenarios | BE Requirements | FE Requirements | Dependencies | Performance Target |
|-------|-----------|------------------|-------------------|---------------|----------------------|
| A — Telegram accumulate-then-generate | A1–A6, T1 | Extend `telegram_pending_actions` (+column, migration), rework pending-action module, rework `telegram.ts` handlers | None | None — independent | N/A (single-user bot) |
| B — Web accumulate-then-generate | B1–B3 | None | `create-story-modal.tsx`, `create-story-form.ts` | None — independent of A and C | N/A |
| C — Diff view on patch proposals | C1, C2, T2 | None | New `computePatchDiff`, new `PatchDiffView`, `story-chat-panel.tsx` wiring, new jsdom test env | None — independent of A and B | Diff computation on typical story-paragraph-length text (a few hundred words) is synchronous and sub-millisecond; no perf work needed |

All three phases touch disjoint files and ship independently — build in any order, verify each with
`npx tsc --noEmit` + `npx vitest run` before moving to the next.

### Derivers

| Deriver | Inputs | Output | Scenarios covered |
|---------|--------|--------|---------------------|
| `appendToAccumulatedSeed` | `current: string \| null`, `next: string` | `string` — `next` trimmed if `current` is null/empty, else `` `${current}\n${next.trim()}` `` | A1, A2 |
| `isReadyToFinalize` | `accumulatedSeed: string \| null` | `boolean` — true iff non-null and non-empty after trim | A4 |
| `isPendingActionExpired` *(existing, unchanged)* | `createdAt: Date`, `now: Date`, `ttlMs: number` | `boolean` | A5 |
| `buildPendingActionUpsert` *(existing, extended)* | `chatId`, `universeId`, `now` | upsert values incl. `accumulatedSeed: null` | A1 (fresh-pick reset) |
| `buildAccumulatedSeed` | `messages: string[]`, `draft: string` | `string` — non-empty trimmed messages joined by `\n\n`, draft appended (trimmed) if non-empty | B1, B2, B3 |
| `computePatchDiff` | `original: string`, `patched: string` | `DiffSegment[]` (`{ type: 'added' \| 'removed' \| 'unchanged'; text: string }[]`) via `diffWords` | C1 |

### Files by scenario

| Scenario | Backend files | Frontend files | Infrastructure files |
|----------|---------------|-----------------|------------------------|
| A1 | `packages/api/src/routes/telegram-pending-action.ts` — `appendPendingSeedText`; `telegram.ts` — `message:text` handler | None | None |
| A2 | `telegram.ts` — new `newgo` callback + shared `finalizePendingStory` helper | None | None |
| A3 | `telegram.ts` — new `/go` command, same helper as A2 | None | None |
| A4 | `telegram.ts` — `finalizePendingStory` early-return branch | None | None |
| A5 | `telegram-pending-action.ts` — `peekPendingAction` TTL check + cleanup | None | None |
| A6 | `telegram.ts` — unchanged fallthrough path (regression pin) | None | None |
| B1 | None | `create-story-modal.tsx`, `create-story-form.ts` (`buildAccumulatedSeed`) | None |
| B2 | None | `create-story-modal.tsx` (remove-note handler) | None |
| B3 | None | `create-story-modal.tsx` (submit folds draft) | None |
| C1 | None | `packages/web/src/lib/compute-patch-diff.ts` (new), `packages/web/src/components/patch-diff-view.tsx` (new), `story-chat-panel.tsx` | None |
| C2 | None | `story-chat-panel.tsx` (`handleApplyPatch`, unchanged call, just fed by the same `pendingPatch`) | None |
| T1 | `packages/core/src/db/schema.ts`, new migration under `packages/core/src/db/migrations/` | None | Migration file (generated + hand-patched for idempotency, per repo convention) |
| T2 | None | `vitest.config.ts` (root), `packages/web/package.json` (new devDeps) | None |

### Files to create

```
packages/web/src/lib/compute-patch-diff.ts        — pure word-diff deriver (DiffSegment[])
packages/web/src/lib/compute-patch-diff.test.ts   — unit tests (added/removed/unchanged, Cyrillic text)
packages/web/src/components/patch-diff-view.tsx        — renders DiffSegment[] with distinct styling
packages/web/src/components/patch-diff-view.test.tsx   — RTL test, asserts added/removed are visually distinguishable
packages/core/src/db/migrations/00XX_*.sql        — ALTER TABLE telegram_pending_actions ADD COLUMN IF NOT EXISTS accumulated_seed text
```

### Files to modify

```
packages/core/src/db/schema.ts
  telegramPendingActions — add accumulatedSeed: text('accumulated_seed') (nullable)

packages/api/src/routes/telegram-pending-action.ts
  + appendToAccumulatedSeed(current, next) — pure
  + isReadyToFinalize(accumulatedSeed) — pure
  buildPendingActionUpsert — always sets accumulatedSeed: null (fresh pick resets accumulation)
  + peekPendingAction(chatId) — read-only; deletes + returns null if expired (cleanup side effect)
  + appendPendingSeedText(chatId, text) — read-modify-write; refreshes createdAt (TTL renewal)
  + consumePendingAction(chatId) — read+delete, returns { universeId, accumulatedSeed } | null
  - consumePendingUniverseChoice removed (superseded by the three functions above)

packages/api/src/routes/telegram.ts
  message:text handler — peekPendingAction instead of consumePendingUniverseChoice;
    live pending row -> appendPendingSeedText + accumulation-ack reply with "✅ Готово" inline button,
    return (skip id-lookup/fallback); absent/expired -> unchanged existing path
  + newgo callback handler + '/go' command — both call shared finalizePendingStory(ctx)
  + finalizePendingStory(ctx) — consumePendingAction; empty accumulated seed -> no-op reply,
    non-empty -> createStoryForUniverse(accumulatedSeed, universeId) (unchanged), same reply wording
  newpick:<id> callback — unchanged call shape, now implicitly resets accumulation via buildPendingActionUpsert

packages/api/src/routes/telegram-new-flow.test.ts
  Update mocks (peekPendingAction/appendPendingSeedText/consumePendingAction replace
    consumePendingUniverseChoice); the "first message after pick fires immediately" test is replaced
    with the new accumulate-then-finalize behavior (A1-A4)

packages/web/src/components/create-story-form.ts
  + buildAccumulatedSeed(messages: string[], draft: string): string — pure
  CreateStoryFormState / validateCreateStoryForm unchanged

packages/web/src/components/create-story-form.test.ts
  + tests for buildAccumulatedSeed (join order, empty-message filtering, draft-only fallback)

packages/web/src/components/create-story-modal.tsx
  + contextMessages: string[] state, "Добавить" button, accumulated-notes list with remove (✕)
  handleSubmit / handleCreateSeries — compute seed via buildAccumulatedSeed(contextMessages, draft)
    before validating, instead of reading form.seed directly from a single textarea

packages/web/src/pages/story-chat-panel.tsx
  Patch-proposal block (~line 192-206) replaced: renders <PatchDiffView original={selectedText}
    patched={pendingPatch.patch} /> instead of the raw <p>{parsed.patch}</p>; summary + Apply button
    unchanged

packages/web/package.json
  + dependency: diff
  + devDependencies: @testing-library/react, @testing-library/jest-dom, @types/react (already present)

package.json (root)
  + devDependencies: jsdom (vitest requires it installed separately for jsdom environment)

vitest.config.ts (root)
  + test.environmentMatchGlobs: [['packages/web/**', 'jsdom']]
```

### Data model changes

`telegram_pending_actions` — add nullable column `accumulated_seed text`. Additive, no backfill, no
change to the primary key or existing `universe_id`/`created_at` columns. See `architecture.md` for
the full rationale.

### Documentation changes

- `docs/architecture/03-telegram-flow.md` — this doc predates even the already-shipped two-step
  universe-picker flow (it still describes the old one-shot `/new` behavior). Rewrite its narrative
  and Mermaid diagram to reflect both the shipped universe picker and the new accumulate-then-finalize
  step, so it stops being stale.
- `docs/architecture/04-feedback-and-review.md` — the "Chat-based feedback" section's first bullet
  ("A message with a selected passage proposes a concrete replacement...") gets one added clause
  noting the proposed replacement now renders as a diff against the original selection, not raw
  replacement text. No diagram change needed — the flow itself (propose → apply) is unchanged, only
  the presentation.

### Decisions made autonomously

- **Finalize triggers: both an inline "✅ Готово" button (resent on every accumulation ack) and a
  `/go` command**, sharing one handler. Reason: matches the task's own suggested defaults exactly;
  a button alone would be undiscoverable if the parent scrolls past the last ack message, a command
  alone is less discoverable for a casual user — both cost nothing extra to support since they share
  one code path.
- **TTL renews on every accumulated message, not just on the initial universe pick.** Reason: a real
  multi-message conversation can easily run past 30 minutes if the parent is composing while doing
  something else; renewing on activity (not on creation) is the standard "session" semantics and
  avoids silently losing a mid-conversation draft, which was flagged as the exact risk the TTL exists
  to manage in the original two-step-flow plan.
- **Finalizing with an empty accumulated seed is a no-op that keeps the pending row alive**, rather
  than an error or silently deleting the row. Reason: the parent might tap "Готово" by mistake before
  typing anything; losing the "waiting for an idea" state as a side effect of that mistake would force
  them to redo `/new` and re-pick the universe for no reason.
- **Removed `consumePendingUniverseChoice` entirely rather than keeping it alongside the three new
  functions.** Reason: it is fully superseded (nothing needs "read+delete+treat-first-message-as-seed"
  anymore) and dead code with the same name-shape as a live function invites a future caller to use
  the wrong one.
- **Web accumulation reuses the existing `CreateStoryModal`/`validateCreateStoryForm` shape rather
  than introducing a chat-style multi-turn AI conversation before generation.** Reason: the task
  description frames "accumulate context ... before the pipeline fires" as user-only message
  accumulation (no AI response needed pre-generation) — this mirrors the Telegram design exactly (the
  bot never calls the LLM until finalize) and avoids scope creep into building a second AI chat
  surface that duplicates the already-shipped post-generation `StoryChatPanel`.
- **Web notes are individually removable (✕ per note) even though Telegram has no equivalent
  undo.** Reason: cheap, low-risk, standard list-editing affordance already used elsewhere in this
  modal's universe-create sub-flow; Telegram has no back-and-forth message-editing primitive to hang
  an equivalent on, so parity isn't expected there.
- **Diff granularity: word-level (`diffWords`), not line-level or character-level.** Reason: matches
  the task's explicit "readable for Russian prose" requirement — line-level is too coarse for
  single-paragraph patches (the common case here), character-level fragments Cyrillic words into
  visually noisy sub-word diffs.
- **`diff` (jsdiff) added as a dependency of `packages/web` only, not `packages/core` or a shared
  package.** Reason: the diff is purely a rendering concern for one panel; nothing server-side or
  cross-package needs it, and `packages/shared` is explicitly reserved for money-formatting utilities
  per `CLAUDE.md`, not a dumping ground for unrelated cross-cutting concerns.
- **New jsdom + React Testing Library environment scoped to `packages/web/**` via
  `environmentMatchGlobs`, not a global `node`→`jsdom` switch.** Reason: every other package's tests
  are non-DOM (pure functions, Express route glue, DB mocks) and gain nothing from jsdom; scoping
  keeps their startup cost and mental model unchanged while giving the one component that needs it
  a real DOM.
- **The diff itself is tested as a pure deriver (`compute-patch-diff.test.ts`, plain vitest, no DOM)
  plus one RTL test on the newly-extracted `PatchDiffView` component in isolation — not a full render
  of `MutableChatPanel`.** Reason: per the constitution's "test what earns it," the business-meaningful
  unit is the diff classification logic (Layer 1, deriver) and the mapping of segment type to visual
  distinguishability (the one DOM-dependent claim in scenario C1); `MutableChatPanel` itself is wiring
  (API calls, scroll refs, chat history) that the constitution treats as Layer 2/4 — type-checked, not
  unit-tested. Extracting `PatchDiffView` as its own component is what makes this split possible
  without a broader `MutableChatPanel` test harness (API mocking, etc.).
- **No hard character cap added to the Telegram accumulated seed.** Reason: the existing single-message
  flow has no cap either; adding one now would be new, unrequested scope, and this is a single-user
  bot where the abuse case (unbounded seed growth) doesn't apply.
- **Discovered mid-implementation: `packages/web/src/components/line-diff.ts` + `diff-viewer.tsx`
  already exist and are used by `plan-review-card.tsx`/`text-review-card.tsx` to compare whole story
  text versions (v1 vs v2) line-by-line.** This was not visible to the `package.json` dependency grep
  done during planning (it's a hand-rolled LCS algorithm, not a library). Decision: kept it untouched
  and did not reuse it for this feature — it operates on whole multi-line documents, and for a
  single-paragraph chat patch with no newlines it would degenerate to "entire passage removed, entire
  passage added" with no word-level distinction, which fails scenario C1's actual requirement. The new
  `computePatchDiff`/`PatchDiffView` is a different granularity for a different UI context, not a
  duplicate; `PatchDiffView`'s color choices (success/error, underline/strikethrough) were aligned to
  `diff-viewer.tsx`'s existing conventions for visual consistency across the app.
- **Plan self-confirmed (`state: confirmed`) with no human review gate.** Reason: this was planned and
  built as a fully autonomous overnight run, per explicit instruction — no human was available to
  review the interview answers or run the consistency gate manually. All nine consistency-gate checks
  passed before promotion; the one open item is a post-hoc manual Telegram smoke test, logged in
  `todo.md`.

### Implementation order

1. `/tdd appendToAccumulatedSeed` — covers A1, A2
2. `/tdd isReadyToFinalize` — covers A4
3. `/tdd buildAccumulatedSeed` — covers B1, B2, B3
4. `/tdd computePatchDiff` — covers C1
5. Migration: `npx drizzle-kit generate`, hand-patch to `ADD COLUMN IF NOT EXISTS`, `npm run db:migrate`
   against the disposable dev branch — covers T1
6. `telegram-pending-action.ts` glue: `peekPendingAction`, `appendPendingSeedText`,
   `consumePendingAction`, remove `consumePendingUniverseChoice`
7. `telegram.ts` controller wiring: `message:text` accumulation branch, `newgo` callback, `/go`
   command, `finalizePendingStory` — covers A1-A6; update `telegram-new-flow.test.ts` to match
8. `create-story-form.ts` + `create-story-modal.tsx` wiring — covers B1-B3
9. `patch-diff-view.tsx` + `story-chat-panel.tsx` wiring — covers C1, C2
10. Test infra: `vitest.config.ts` `environmentMatchGlobs`, new devDeps, `patch-diff-view.test.tsx` — covers T2
11. Docs: `docs/architecture/03-telegram-flow.md` rewrite, `04-feedback-and-review.md` one-clause update
12. Full verification pass: `npx tsc --noEmit`, `npx vitest run`

### Scope boundary

Out of scope:
- Any AI/LLM involvement in the pre-generation accumulation step (Telegram or web) — accumulation is
  plain message concatenation, no model call until the existing pipeline fires at finalize.
- Editing or reordering accumulated messages in Telegram (web gets remove-only; Telegram gets neither
  — matches its append-only chat medium).
- Any change to the already-shipped chat-with-patch mechanism itself (targeted patch, whole-story
  banking, read-only comments on finished stories) — this spec only changes how the proposed patch is
  *displayed*, never how it's generated or applied.
- Character/line-level diff toggle or user-configurable diff granularity — word-level only.
- Any change to `packages/core` pipeline stages, prompts, or the `dispatchAutoPipeline` contract.
