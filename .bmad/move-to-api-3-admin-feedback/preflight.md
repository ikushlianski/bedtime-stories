---
type: preflight
branch: main
task: move-to-api-3-admin-feedback
state: confirmed
updated: 2026-04-25
parent-preflight: ../move-to-api/preflight.md
prerequisite: move-to-api-2-overrides-cost
---

# Preflight: Mid-Pipeline Swap + Admin + VFM (Phase 3)

External API contracts live in `../move-to-api/preflight.md`. Phase 3 is mostly **internal endpoints + new tables + derivation math**, plus one new web page.

## Assumptions in effect (Phase 3)

- **Phases 1 and 2 are merged and confirmed.** Verify via each phase's `decisions.md`. Phase 3 depends on `model_calls` accumulating, `model_catalog` populated, story-detail cost block already rendering.
- **Existing tables `parent_reviews` and `child_reactions` provide the rating signals** for joy-per-dollar. Verified in `packages/core/src/db/schema.ts`. Joy-per-dollar formula: `(parentReviews.rating + childReactions.enjoyed) / sum(model_calls.usd)` averaged per model; null when `total_usd = 0`.
- **`stories.planIterations` exists** (or a column with that semantic) and counts plotter iterations per story. **Verify before coding** `derivePlanIterationsPerModel` — if the column is named differently (e.g. `plan_iteration_count`), update the deriver's input shape and the spec accordingly.
- **`run_snapshots` carries the per-stage `<stage>Model` columns** that record actually-used models. Used by `deriveStoriesTable` to render "models per stage."
- **Stage rerun trigger is queue-based** (existing `packages/core/src/queue/` mechanism). Phase 3 cannot atomically span the queue dispatch in a Postgres transaction — accepted as **eventual consistency on the rerun trigger**: the swap event row + `run_snapshots` update commit in one DB transaction, and the rerun job is dispatched in a post-commit step. If dispatch fails, a follow-up worker scans for swap events without a corresponding rerun. Recorded in `decisions.md` during /implement.
- **`/admin` has no auth.** Single-user trust boundary — same as the rest of the app. No middleware to add.
- **`stage_output_text` for `tokensPerChar`** is reachable per-call. The deriver expects pre-aggregated `(model, sum_tokens_out, sum_output_chars)` rows. The endpoint is responsible for assembling the SQL aggregate; the deriver is pure.
- **The "rate value-for-money" link on `story-reader.tsx`** anchors to `/admin#story-<id>` (or similar). Inbox section scrolls to anchor on load. No router-deep-link complexity required.

## Out-of-scope assumptions

- Hard budget caps (separate task).
- Real-time cost streaming (separate task).
- Backfilling cost for pre-OpenRouter stories (separate task — they render "—" in the dashboard).

## To verify (before implementation)

1. `.bmad/move-to-api-1-runner/decisions.md` and `.bmad/move-to-api-2-overrides-cost/decisions.md` both `state: confirmed`.
2. `stories.planIterations` column exists (or rename in the deriver/spec to match the actual column).
3. `parent_reviews.rating` and `child_reactions.enjoyed` (or equivalent) columns exist.
4. Existing queue mechanism supports post-commit job dispatch (or pick a `setImmediate` / outbox pattern at implementation time).
