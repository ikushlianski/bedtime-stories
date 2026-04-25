---
type: plan-summary
branch: main
task: move-to-api-3-admin-feedback
state: confirmed
phases-skipped: []
updated: 2026-04-25
parent-plan: move-to-api
sequence: 3 of 3
prerequisite: move-to-api-2-overrides-cost
---

# Plan Summary: Mid-Pipeline Swap + Admin Dashboard + VFM Inbox (Phase 3 of 3)

The final phase. Adds mid-pipeline model swapping with reason capture, the asynchronous value-for-money rating inbox, and the `/admin` dashboard with leaderboards. This phase introduces the two remaining tables (`model_swap_events`, `value_for_money_feedback`) and the eight aggregation derivers.

## Prerequisite

Phases 1 and 2 must be confirmed and merged. This phase assumes the runner is in place, `model_calls` rows accumulate, the story-detail page already shows cost, and `/api/models` exists.

## What changes in business logic

Mid-pipeline, the user can swap any stage's model and is required to record a short reason every time. The swap is logged with from-model, to-model, stage, reason chip, free-text note. After swap, the named stage reruns with the new model; downstream stages do not auto-rerun. `run_snapshots.<stage>Model` updates to the new model.

After reading a story to Sasha and tapping "read", the parent can asynchronously rate value-for-money from `/admin` — typing or dictating one sentence and a 1–5 score. The read flow itself stays a single tap with no modal.

Joy-per-dollar, plan-iterations per model, swap-rate per model, tokens-per-char per model, and free-tier completion rate become first-class metrics surfaced on `/admin`.

## What changes in user experience

**Mid-pipeline** — a "swap model and rerun this stage" button is visible on stages that have already produced an output. Clicking opens a modal: chip list (`too verbose`, `broke format`, `boring prose`, `too slow`, `failed`, `other`) + free-text input. Submission blocks until either a chip or text is present. Submit triggers the rerun.

**Story-detail** gains a "rate value-for-money" link that drops the story into the `/admin` inbox.

**`/admin`** — a single new page with four sections:
- Spend over time (line chart, current month).
- Sortable stories table (title, date, models per stage, total tokens, total USD, parent rating, child rating, joy-per-dollar).
- Model leaderboard (joy-per-dollar, plan-iterations per model, swap-rate per model, tokens-per-char per model, free-tier completion rate).
- Awaiting-feedback inbox (stories with status in ('ready','read') and no value_for_money_feedback row). Each row has a 1–5 rating input and a textarea.

## What changes architecturally

Two new tables: `model_swap_events` and `value_for_money_feedback`. Eight new pure derivers in `packages/core/src/cost/aggregations/` for the leaderboard math. Endpoints in `packages/api/src/routes/`: `POST /api/stories/:id/swap-model`, `POST /api/stories/:id/value-for-money`, `GET /api/admin/spend-over-time`, `GET /api/admin/model-leaderboard`, `GET /api/admin/awaiting-feedback`, `GET /api/admin/stories-table`. New web components: `swap-model-modal.tsx`, plus the `/admin` page composed of section components.

The swap endpoint writes the `model_swap_events` row in the same DB transaction as the stage status update; the actual rerun trigger is enqueued via the existing queue mechanism — accepted as eventual consistency on the trigger itself (recorded as a decision in `decisions.md`).

## Decisions made autonomously

- Swap atomicity: `model_swap_events` row + `run_snapshots.<stage>Model` update happen in one DB transaction. The rerun job is dispatched after commit. If dispatch fails, a follow-up worker scans for swap events without a corresponding rerun. Recorded in `decisions.md`.
- Joy-per-dollar guards against div-by-zero: `null` (excluded from leaderboard) when `total_usd = 0`.
- Stories with no rating yet are excluded from leaderboards, not treated as 0.
- Inbox query is a left-join on `value_for_money_feedback` filtered to NULL — no flag column on `stories`.
- `/admin` has no auth — single-user trust boundary, same as the rest of the app.
