# Superseded

This plan was split into three sequenced phases on 2026-04-25 because it exceeded the `/implement` skill's coherence budget (8 scenarios, ~42 files vs. the ~5/~8 single-run threshold).

Implement the phases in order:

1. **`.bmad/move-to-api-1-runner/`** — Foundation. Replaces Claude SDK with OpenRouter runner, adds `model_catalog` + `model_calls` tables, cost recorder, catalog sync, and removes hardcoded model constants. Covers SCENARIO 1, 7, 8. **No user-visible UI changes.**

2. **`.bmad/move-to-api-2-overrides-cost/`** — Surfaces the foundation: per-stage override picker on the new-story form, `GET /api/models`, story-detail cost block, story-list cost column. Covers SCENARIO 2, 6. Depends on Phase 1.

3. **`.bmad/move-to-api-3-admin-feedback/`** — Mid-pipeline swap modal + endpoint, value-for-money inbox, `/admin` dashboard with leaderboards. Adds `model_swap_events` + `value_for_money_feedback` tables and the eight aggregation derivers. Covers SCENARIO 3, 4, 5. Depends on Phase 2.

Original `discussion.md`, `flows.md`, and `preflight.md` in this folder remain the canonical reference for assumptions and external API contracts. The three new folders cite them rather than duplicate.
