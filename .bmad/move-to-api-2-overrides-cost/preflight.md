---
type: preflight
branch: main
task: move-to-api-2-overrides-cost
state: confirmed
updated: 2026-04-25
parent-preflight: ../move-to-api/preflight.md
prerequisite: move-to-api-1-runner
---

# Preflight: Per-Story Overrides + Story-Detail Cost (Phase 2)

External API contracts live in `../move-to-api/preflight.md`. Phase 2 is **API + UI on top of Phase 1's foundation** — no new OpenRouter integration. Most assumptions concern existing code shape.

## Assumptions in effect (Phase 2)

- **Phase 1 is merged and confirmed.** `model_catalog`, `model_calls`, `OpenRouterRunner`, `derivePerStageModels`, and the catalog sync job are all in place. Verify by reading `.bmad/move-to-api-1-runner/decisions.md` and confirming `state: confirmed`.
- **`derivePerStageModels` already accepts a per-story override map.** Phase 1 wired the parameter but left it dormant. Phase 2 only adds the API + UI feeders. If Phase 1 dropped this parameter (deviation from its spec), Phase 2 must reopen Phase 1 first.
- **The new-story entry point on the web side is `packages/web/src/components/create-story-modal.tsx`** (verified by grep), not a `pages/new-story.tsx`. Pickers and `perStageOverrides` payload extension land there.
- **The create-story API request schema lives in `packages/api/src/routes/create-story-schema.ts`** (Zod). Extending it is a single-file change; the route handler in `stories.ts` reads the parsed schema and forwards to the orchestrator.
- **`run_snapshots.<stage>Model` columns already exist** for every stage in the pipeline. Phase 2 changes which value gets written there (resolved-map result, not universe default) — no schema migration.
- **`/api/models` is a thin SELECT** filtered to `deleted_at IS NULL`. No pagination required for v1 (catalog is small).
- **Story-detail data fetch already exists** and can be extended to LEFT JOIN `model_calls`. Verify by reading the existing handler before editing.

## Out-of-scope assumptions

- Mid-pipeline swap (Phase 3).
- Leaderboard formulas (Phase 3).
- Inbox query and VFM table (Phase 3).

## To verify (before implementation)

1. `.bmad/move-to-api-1-runner/decisions.md` → `state: confirmed`, all scenarios passed.
2. `derivePerStageModels` signature accepts the per-story override map as documented in Phase 1's spec.
3. `packages/api/src/routes/create-story-schema.ts` exists and is the canonical request schema (no rival schema in `stories.ts`).
4. `packages/web/src/components/create-story-modal.tsx` is the new-story UI entry point (no rival page-level form).
