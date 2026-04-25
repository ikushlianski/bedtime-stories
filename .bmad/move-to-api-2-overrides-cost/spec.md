---
type: spec
branch: main
task: move-to-api-2-overrides-cost
state: confirmed
phases-skipped: []
updated: 2026-04-25
prerequisite: move-to-api-1-runner
---

# Spec: Per-Story Overrides + Story-Detail Cost

### Derivers (mandatory)

| Deriver | Inputs | Output | Scenarios covered |
|---------|--------|--------|-------------------|
| `deriveStoryCostBreakdown` | rows from `model_calls` for one story | `{ totalUsd, perStage: [{ stage, model, attempt, tokensIn, tokensOut, usd }] }` ordered by created_at | SCENARIO 6 |

`derivePerStageModels` already exists from Phase 1 and accepts a per-story override map. Phase 2 wires the API + UI to feed it real overrides; no deriver change.

### Files to create

```
packages/
├── core/
│   └── src/
│       └── cost/
│           └── aggregations/
│               ├── derive-story-cost-breakdown.ts
│               └── derive-story-cost-breakdown.test.ts
├── api/
│   └── src/
│       └── routes/
│           └── models.ts                                — GET /api/models (catalog, deleted_at IS NULL)
└── web/
    └── src/
        └── components/
            └── model-picker.tsx                         — per-stage dropdown + fallback dropdown + filters (free-only, sort by price)
```

### Files to modify

```
packages/
├── api/
│   └── src/
│       └── routes/
│           ├── create-story-schema.ts                   — extend Zod schema to accept perStageOverrides (partial map of stage → { model, fallback })
│           └── stories.ts                               — forward perStageOverrides to orchestrator; story-detail GET joins model_calls
├── core/
│   └── src/
│       └── pipeline/
│           └── orchestrator.ts                          — write resolved-map model id (not universe default) into run_snapshots.<stage>Model
└── web/
    └── src/
        ├── components/
        │   └── create-story-modal.tsx                   — render ModelPicker per stage; include perStageOverrides in create payload (this is the actual new-story entry point, not a /pages/ file)
        └── pages/
            ├── story-list.tsx                           — column for total USD when present, "—" otherwise
            └── story-reader.tsx                         — cost-summary block when status=ready and model_calls exist
```

API route to modify: `packages/api/src/routes/create-story-schema.ts` and `packages/api/src/routes/stories.ts` (the schema file owns request validation; the route file owns handling). Read both before editing.

Do not change: runner, cost-recorder, model_catalog, model_calls schema, sync-catalog, derivePerStageModels (Phase 1 already shipped it), any pipeline stage file.

### Data model changes

None. Existing `run_snapshots.<stage>Model` columns absorb the override. Existing `model_calls` table feeds the cost block.

### Implementation order

1. `/tdd deriveStoryCostBreakdown` — covers SCENARIO 6
2. Add `GET /api/models` endpoint returning rows from `model_catalog` where `deleted_at IS NULL` — covers SCENARIO 2 integration
3. Modify create-story API to accept `perStageOverrides` and forward to orchestrator
4. Modify orchestrator to write resolved-map model ids into `run_snapshots.<stage>Model`
5. Build `model-picker.tsx` component (dropdown + fallback + filters)
6. Add per-stage pickers to the new-story form; include `perStageOverrides` in the create payload
7. Modify story-detail data fetch to join `model_calls`
8. Render cost-summary block in `story-reader.tsx` when `model_calls` rows exist
9. Add total-USD column to `story-list.tsx` (renders "—" for legacy)
10. Smoke-test: create a story with a writer override, verify `run_snapshots.writerModel` matches the override, wait for ready, open story-detail, verify cost block renders with the override model

### Scope boundary

- **In scope**: per-stage override picker on new-story form, override propagation through API to orchestrator to run_snapshots, story-detail cost block, story-list cost column, GET /api/models.
- **Out of scope (Phase 3)**: mid-pipeline swap modal + endpoint, value-for-money rating + inbox, /admin dashboard, leaderboard derivers, "rate value-for-money" link on story-detail.
- **Out of scope (Phase 1, already shipped)**: runner, cost recording, catalog sync, hardcoded constant removal.
