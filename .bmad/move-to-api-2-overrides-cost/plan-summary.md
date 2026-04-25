---
type: plan-summary
branch: main
task: move-to-api-2-overrides-cost
state: confirmed
phases-skipped: []
updated: 2026-04-25
parent-plan: move-to-api
sequence: 2 of 3
prerequisite: move-to-api-1-runner
follow-on: move-to-api-3-admin-feedback
---

# Plan Summary: Per-Story Overrides + Story-Detail Cost (Phase 2 of 3)

This phase makes the runner foundation visible to the user. It exposes the model catalog through `/api/models`, adds per-stage dropdowns + fallback dropdowns to the new-story form, and renders cost on the story-detail page once a story is `ready`. **No admin dashboard, no mid-pipeline swap, no value-for-money inbox** — those ship in Phase 3.

## Prerequisite

Phase 1 (`move-to-api-1-runner`) must be confirmed and merged. This phase assumes `model_catalog` and `model_calls` tables exist, the OpenRouterRunner is in place, and `derivePerStageModels` already accepts a per-story override map (which Phase 1 wired but left unused).

## What changes in business logic

A per-story override at creation time replaces the universe default for that stage only. `run_snapshots.<stage>Model` records the actually-used model id (override, not universe default).

A story-detail page that already shows `status='ready'` now also shows total USD spent and a per-stage breakdown (stage, model, tokens in/out, USD). Stories with no `model_calls` rows (legacy / pre-OpenRouter) render no cost block — not "$0".

## What changes in user experience

**New-story form** gains a per-stage section with six (or more) model dropdowns + fallback dropdowns, each populated from `/api/models`. Dropdowns show price label and free badge. Filters: free-only toggle, sort by input price ascending. The universe's default is pre-selected; the user can leave it alone for the cheapest path.

**Story-list page** gains a total-USD column (shows "—" when no model_calls rows exist).

**Story-detail page** renders a cost-summary block when `model_calls` rows exist for the story: total USD, per-stage breakdown ordered by created_at, with stage / model / tokens / USD per row.

## What changes architecturally

A new `GET /api/models` endpoint returns the synced catalog filtered to non-deleted rows. New cost derivation lives in `packages/core/src/cost/aggregations/derive-story-cost-breakdown.ts` as a pure function on `model_calls` rows. The story-detail data fetch joins `model_calls`. The new-story create payload accepts a `perStageOverrides` partial map; the API forwards it to the orchestrator, which passes it to `derivePerStageModels`. `run_snapshots.<stage>Model` is written from the resolved map, not the universe default.

No new tables. No changes to the runner or the cost-recording side effect — Phase 1 already writes `model_calls` rows for every call.

## Decisions made autonomously

- No new database columns; `run_snapshots` already has per-stage model fields, and the override path simply changes which value gets written there.
- The "rate value-for-money" link on the story-detail page is added in Phase 3 with the inbox.
- Picker filters live in client state on the new-story form; no server-side search.
- A story-list integration test verifies the override path end-to-end (creates a story with override, asserts run_snapshots row).
