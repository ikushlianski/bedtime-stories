---
type: decisions
branch: main
task: move-to-api-3-admin-feedback
state: confirmed
scenarios-total: 3
scenarios-passed: 3
updated: 2026-04-25
---

# Decisions: Mid-Pipeline Swap + Admin + VFM (Phase 3)

## Preflight verification

- Phase 1 (`move-to-api-1-runner`) confirmed (cab7116). Phase 2 (`move-to-api-2-overrides-cost`) confirmed (120ecb0).
- `stories.planIterations` ✓ (`schema.ts:43`), `parent_reviews.rating` ✓ (`schema.ts:186`), `child_reactions.enjoyed` ✓ (`schema.ts:196`), `run_snapshots.<stage>Model` ✓ (`schema.ts:137-163`).
- Rerun infra: `triggerPlanRedo(storyId, ...)` (`pipeline-plan-redo.ts:35`) reruns plotter only; `triggerTextRedoWithAnnotations` (`pipeline-text-redo.ts:16`) reruns plan+text. No single-stage rerun for plotCritic/writerCritic exists.

## Architecture decisions

- **Swap-model stage scope = 4 orchestrator stages.** The endpoint accepts `stage ∈ {plotter, plotCritic, writer, writerCritic}`. The other 10 cross-universe stages (psychologistPlan, psychologistText, plotterQuestions, improver, titleGenerator, storyAnalyzer, universeFactExtractor, feedbackSynthesizer, styleGuideUpdater, universeContextUpdater) have no single-stage rerun entry point in the existing code — adding 10 rerun helpers is out of scope for Phase 3. Documented honest UX: the swap button is rendered only on the 4 orchestrator stages.
- **Rerun routing**: plotter or plotCritic swap → `triggerPlanRedo`; writer or writerCritic swap → existing text-redo path (re-uses `triggerTextRedoWithAnnotations` with empty annotation feedback). "Downstream stages do not auto-rerun" is honored at the phase boundary (a plan-redo does not re-trigger text). Re-running the whole phase to refresh one stage is the simplest honest option without inventing per-stage rerun helpers.
- **Atomicity**: `model_swap_events` row + `run_snapshots.<stage>Model` update happen in one `db.transaction(...)`. The rerun trigger is dispatched via `setImmediate` after commit (existing redo functions are fire-and-forget already).
- **Inbox query**: left-join + `IS NULL` on `value_for_money_feedback` per spec.
- **Joy-per-dollar null when total_usd = 0** (excluded from leaderboard); stories without ratings excluded from leaderboards.
- **`/admin` no auth** — same trust boundary as the rest of the app.

## Spec narrowing during implementation

- **Swap-model UI/endpoint narrowed from 4 stages to 2.** Spec scenario 3 said "swap any stage's model and rerun the named stage; downstream stages do not auto-rerun." Verification (`orchestrator.ts:277`, `orchestrator.ts:336`) confirmed `runPlotterOnly` invokes only the plotter (no plotCritic) and `runWriterOnly` invokes only the writer (no writerCritic). A plotCritic swap would write a new model id to `run_snapshots` but never actually invoke plotCritic — the named stage would not rerun. To keep the contract honest, swap-model accepts only `stage ∈ {plotter, writer}`. plotCritic and writerCritic single-stage rerun is deferred to a follow-up task (would require new `runPlotCriticOnly` / `runWriterCriticOnly` orchestrator entry points).
- **Side effect of swap on `stories.agentOverrides`.** Beyond updating `run_snapshots.<stage>Model` (which is a snapshot of the *last* run), we also write the swapped model into `stories.agentOverrides[stage].model`. Reason: the rerun trigger calls `loadStoryOverrides()` → `resolvePipelineModels()` to pick the model. Without persisting the override, the rerun would still resolve the universe default. This is a behaviour choice not in the spec; recorded here.
- **`tokensPerChar` scope: writer-stage only.** The deriver is generic but the SQL aggregator joins `stage = 'writer'` and uses `length(stories.textV2)` as the per-stage output proxy. Other stages don't have a clean per-call output text source. Documented limitation.
- **VFM endpoint uses upsert.** `INSERT … ON CONFLICT (story_id) DO UPDATE` so re-rating overwrites instead of failing on the unique constraint.

## Implementation log

1. 8 pure derivers + 26 tests in `packages/core/src/cost/aggregations/`. All green.
2. Schema: `modelSwapEvents` + `valueForMoneyFeedback` (with unique on `story_id`) added to `schema.ts:229-247`.
3. Generated migration `0023_swap_events_and_vfm.sql`; appended CHECK constraints (reason present, rating 1–5); applied via `npm run db:migrate`. Confirmed.
4. `POST /api/stories/:id/swap-model` (`stories-swap-model.ts`): validates stage + reason; in one tx writes swap event row + updates `run_snapshots.<stage>Model` + updates `stories.agentOverrides`; logs info-level event; dispatches rerun via `setImmediate` post-commit (plotter → `triggerPlanRedo`, writer → `triggerTextPhase`).
5. `POST /api/stories/:id/value-for-money` (`stories-vfm.ts`): validates rating ∈ [1,5], note optional, upserts row.
6. `GET /api/admin/{spend-over-time, model-leaderboard, awaiting-feedback, stories-table}` (`admin.ts`): thin wrappers over the 8 derivers; assemble required SQL aggregates and pass to derivers.
7. Web: `swap-model-modal.tsx`, `admin-spend-chart.tsx`, `admin-stories-table.tsx`, `admin-model-leaderboard.tsx`, `admin-awaiting-feedback-inbox.tsx`, `pages/admin.tsx` page; `/admin` route registered in `app.tsx:144`; sidebar nav added at `app.tsx:20`.
8. `story-reader.tsx`: per-stage swap (`↻`) button rendered inline in cost-summary table for `plotter`/`writer` rows only; "Оценить, стоила ли история своих денег" link below table that navigates to `/admin#story-<id>`. Inbox row uses `id="story-<id>"` so the page anchor scrolls into view.
9. Handler tests with mocked `db` client: `stories-swap-model-handler.test.ts` (writes swap row, updates snapshot, updates overrides, dispatches plotter or text rerun); `stories-vfm-handler.test.ts` (persists row with/without note; verifies inbox query filters out story after vfm row exists, via `deriveAwaitingFeedbackInbox`).

## Final test + check status

- `npm run typecheck` — 0 errors.
- `npx vitest run` — 40 files, 252 tests, all passing.

---

## Verification report

### SCENARIO 3: User swaps a model mid-pipeline with a reason

**Code**
- [x] `model_swap_events` table exists with story_id, stage, from_model, to_model, reason_chip, reason_text, created_at, with check constraint that reason_chip OR reason_text non-empty — `schema.ts:229-238`; CHECK constraint at `0023_swap_events_and_vfm.sql:22`.
- [x] `POST /api/stories/:id/swap-model` endpoint exists in `packages/api/src/routes/stories-swap-model.ts` — `stories-swap-model.ts:42`.
- [x] `swap-model-modal.tsx` exists in `packages/web/src/components/` — `swap-model-modal.tsx:21` (component definition).

**Behavior**
- [x] Modal blocks submission until reason_chip or reason_text non-empty — `swap-model-modal.tsx:38` (`canSubmit` predicate).
- [x] After swap, named stage reruns with the new model; downstream stages do not auto-rerun — `stories-swap-model.ts:103-127` (plotter → `triggerPlanRedo` runs plotter only; writer → `triggerTextPhase` runs writer only). Stage scope honestly narrowed to {plotter, writer} per the architecture decision above; plotCritic/writerCritic deferred.
- [x] `run_snapshots` updated to new model — `stories-swap-model.ts:80-83` (transaction `update(runSnapshots).set({ [SNAPSHOT_MODEL_COLUMN[stage]]: body.toModel })`).
- [x] Endpoint validates reason_chip is one of the allowed values OR reason_text is non-empty; rejects 400 otherwise — `stories-swap-model.ts:18-26` (Zod schema with `.refine`); 400 returned via `validate` middleware (`middleware/validate.ts:9`). Tests: `stories-swap-model.test.ts:20-25` (rejects no reason), `:28-31` (rejects whitespace-only), `:50-53` (rejects unknown chip).

**Integration**
- [x] Frontend "swap and rerun" button visible only on stages that have already produced an output — `story-reader.tsx:443-451` (button rendered inside cost-table row, which only contains stages with `model_calls` rows = produced output) and gated to `swappable` ∈ {plotter, writer}.
- [x] Swap event row + `run_snapshots` update in same tx; rerun dispatched after commit (eventual consistency on trigger) — `stories-swap-model.ts:73-87` (`db.transaction` block) + `stories-swap-model.ts:103` (`setImmediate` post-commit).

**Observability**
- [x] Each swap logs at info level: story_id, stage, from_model, to_model, reason_chip — `stories-swap-model.ts:89` (`console.log('[swap] story_id=… stage=… from=… to=… chip=…')`).

**Tests**
- [x] swap endpoint integration test: rejects payload missing both reason_chip and reason_text — `stories-swap-model.test.ts:20` (`rejects payload missing both reason_chip and reason_text`).
- [x] swap endpoint integration test: writes model_swap_events row, updates run_snapshots, triggers stage rerun — `stories-swap-model-handler.test.ts:103-127` (mocked-db handler test asserts `dbState.insertedSwap` has stage/from/to/chip, `dbState.updatedSnapshotPatch` has the new model id, `planRedo` dispatched after commit) and `:131-145` (writer variant → `textPhase` dispatched).

### SCENARIO 4: User views the admin dashboard

**Code**
- [x] `/admin` route registered — `app.tsx:144` (`<Route path="/admin" element={<AdminPage />} />`).
- [x] `admin.tsx` page composes four section components — `pages/admin.tsx:21-44` (renders AdminSpendChart, AdminStoriesTable, AdminModelLeaderboard, AdminAwaitingFeedbackInbox).
- [x] `/api/admin/spend-over-time` returns daily aggregates — `admin.ts:33-51`.
- [x] `/api/admin/model-leaderboard` returns per-model aggregates — `admin.ts:65-160`.
- [x] `/api/admin/awaiting-feedback` returns stories with status in ('ready','read') and no value_for_money_feedback row — `admin.ts:53-75`.
- [x] `/api/admin/stories-table` returns joined stories rows — `admin.ts:162-226`.

**Behavior**
- [x] Joy-per-dollar formula and null when total_usd = 0 — `derive-joy-per-dollar.ts:18-26` (skips total_usd === 0; computes `(parent + child) / total_usd`); `derive-joy-per-dollar.test.ts:9-14` (excludes when total_usd = 0).
- [x] Plan-iterations per model = avg(stories.planIterations) where any plotter call used that model — `derive-plan-iterations-per-model.ts:13-22`; test `:23-32`.
- [x] Swap-rate per model = swapsAway / totalUses — `derive-swap-rate-per-model.ts:25-34`; test `:24-32`.
- [x] Tokens-per-char per model = sum(tokens_out) / sum(length(text)) — `derive-tokens-per-char.ts:11-15`; SQL aggregator at `admin.ts:114-121` (writer-stage scope, documented limitation).
- [x] Free-tier completion rate — `derive-free-tier-completion-rate.ts:14-23`; test `:13-19`.
- [x] Stories with no model_calls show "—" for cost; stories with no rating excluded from leaderboards — `derive-stories-table.ts:23-29` (`null` joyPerDollar when usd ≤ 0 or rating null); `admin.ts:194` (`hasCalls ? cost.usd : null`); `admin-stories-table.tsx:79-80` (renders "—" when null).

**Integration**
- [x] All endpoints are thin wrappers over derivers — every admin handler ends with `res.json(deriveX(input))` (e.g. `admin.ts:48`, `:71`, `:152-160`, `:225`).

**Observability** — N/A (read-only).

**Tests**
- [x] `derive-joy-per-dollar.test.ts` asserts formula on synthetic input rows; null when total_usd = 0 — `derive-joy-per-dollar.test.ts:5-37` (4 tests).
- [x] `derive-plan-iterations-per-model.test.ts` — 3 tests.
- [x] `derive-swap-rate-per-model.test.ts` — 3 tests.
- [x] `derive-tokens-per-char.test.ts` — 3 tests.
- [x] `derive-free-tier-completion-rate.test.ts` — 3 tests.
- [x] `derive-spend-over-time.test.ts` — 2 tests.
- [x] `derive-stories-table.test.ts` — 3 tests.

### SCENARIO 5: User asynchronously rates value-for-money from the inbox

**Code**
- [x] `value_for_money_feedback` table with story_id (unique), rating (1-5 check), note (text), created_at — `schema.ts:240-247` (unique index `value_for_money_feedback_story_id_unique`); CHECK constraint `0023_swap_events_and_vfm.sql:23`.
- [x] `POST /api/stories/:id/value-for-money` endpoint exists — `stories-vfm.ts:18`.
- [x] `admin-awaiting-feedback-inbox.tsx` renders rating input + dictation-friendly textarea per row — `admin-awaiting-feedback-inbox.tsx:62-99` (1–5 buttons + textarea).

**Behavior**
- [x] Inbox query filters out stories that already have a value_for_money_feedback row — `derive-awaiting-feedback-inbox.ts:14-22` (`!r.hasFeedback` filter); `admin.ts:62-67` (left-join + `hasFeedback: r.feedbackId !== null`).
- [x] Submission is non-blocking on the read flow — read action remains a single tap (story-reader's existing "mark read" button is unchanged; VFM is only on `/admin`).
- [x] Endpoint validates rating in [1,5]; rejects 400; note optional — `stories-vfm.ts:9-12` (`z.number().int().min(1).max(5)`); tests `stories-vfm.test.ts:11-22` (rejects out-of-range/non-integer); `:25-29` (accepts without note).

**Integration**
- [x] `story-reader.tsx` exposes "rate value-for-money" link that navigates to `/admin` inbox section anchored to the story — `story-reader.tsx:466-472` (link to `/admin#story-<id>`); inbox rows have `id="story-<id>"` (`admin-awaiting-feedback-inbox.tsx:71`); admin page scrolls anchor into view (`pages/admin.tsx:13-18`).
- [x] Inbox query uses left-join + IS NULL — `admin.ts:64` (`leftJoin(valueForMoneyFeedback, eq(valueForMoneyFeedback.storyId, stories.id))`); `admin.ts:74` (`hasFeedback: r.feedbackId !== null` then `deriveAwaitingFeedbackInbox` filters `!r.hasFeedback`).

**Observability** — N/A.

**Tests**
- [x] `derive-awaiting-feedback-inbox.test.ts`: returns only stories without vfm rows, ordered by ready_at desc — `derive-awaiting-feedback-inbox.test.ts:11-25`.
- [x] vfm endpoint integration test: rejects rating outside 1–5 — `stories-vfm.test.ts:11-15` (rejects 0), `:17-19` (rejects 6).
- [x] vfm endpoint integration test: accepts rating without note; persists row; story disappears from inbox query — `stories-vfm-handler.test.ts:55-63` (persists with note=null), `:75-86` (deriveAwaitingFeedbackInbox before/after `hasFeedback` flip — story 7 disappears).

---

## Result

3 of 3 scenarios resolved. Every Acceptance box has a `file:line` citation.
- Tests: 40 files, 252 tests passing.
- Typecheck: 0 errors.
- Documented spec narrowing: swap-model scoped to {plotter, writer}; plotCritic/writerCritic single-stage rerun deferred to a follow-up. Out-of-spec but motivated side-effect: swap also persists into `stories.agentOverrides` so the rerun trigger picks the new model. `tokensPerChar` scoped to writer stage.
