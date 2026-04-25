---
type: spec
branch: main
task: move-to-api-3-admin-feedback
state: confirmed
phases-skipped: []
updated: 2026-04-25
prerequisite: move-to-api-2-overrides-cost
---

# Spec: Mid-Pipeline Swap + Admin Dashboard + VFM Inbox

### Derivers (mandatory)

| Deriver | Inputs | Output | Scenarios covered |
|---------|--------|--------|-------------------|
| `deriveJoyPerDollar` | joined rows of (story, parentReviews.rating, childReactions.enjoyed, sum(model_calls.usd)), groupBy = model id appearing in any stage | `[{ model, avgJoyPerDollar, sampleSize }]`; null when total_usd = 0 | SCENARIO 4 |
| `derivePlanIterationsPerModel` | rows of (storyId, plotterModel, planIterations) | `[{ model, avgPlanIterations, sampleSize }]` | SCENARIO 4 |
| `deriveSwapRatePerModel` | rows from `model_swap_events`, rows of (storyId, all stage models used) | `[{ model, swapsAway, totalUses, swapRate }]` | SCENARIO 4 |
| `deriveTokensPerChar` | rows of (model, sum tokens_out, sum length(stage_output_text)) | `[{ model, tokensPerChar }]` | SCENARIO 4 |
| `deriveFreeTierCompletionRate` | all stories, all `model_calls` rows | `{ rate, freeOnlyStoryCount, totalStoryCount }` | SCENARIO 4 |
| `deriveAwaitingFeedbackInbox` | stories with status in ('ready','read'), value_for_money_feedback rows | list of stories without a feedback row, ordered by ready_at desc | SCENARIO 4, 5 |
| `deriveSpendOverTime` | rows from `model_calls` for date range | `[{ date, totalUsd, perModel: [{ model, usd }] }]` | SCENARIO 4 |
| `deriveStoriesTable` | joined rows of (story, run_snapshots, model_calls, parentReviews, childReactions) | `[{ storyId, title, date, modelsPerStage, totalTokens, totalUsd, parentRating, childRating, joyPerDollar }]` | SCENARIO 4 |

All pure functions in `packages/core/src/cost/aggregations/`.

### Files to create

```
packages/
├── core/
│   └── src/
│       ├── cost/
│       │   └── aggregations/
│       │       ├── derive-joy-per-dollar.ts
│       │       ├── derive-joy-per-dollar.test.ts
│       │       ├── derive-plan-iterations-per-model.ts
│       │       ├── derive-plan-iterations-per-model.test.ts
│       │       ├── derive-swap-rate-per-model.ts
│       │       ├── derive-swap-rate-per-model.test.ts
│       │       ├── derive-tokens-per-char.ts
│       │       ├── derive-tokens-per-char.test.ts
│       │       ├── derive-free-tier-completion-rate.ts
│       │       ├── derive-free-tier-completion-rate.test.ts
│       │       ├── derive-awaiting-feedback-inbox.ts
│       │       ├── derive-awaiting-feedback-inbox.test.ts
│       │       ├── derive-spend-over-time.ts
│       │       ├── derive-spend-over-time.test.ts
│       │       ├── derive-stories-table.ts
│       │       └── derive-stories-table.test.ts
│       └── db/
│           └── migrations/
│               └── <next>_swap_events_and_vfm.sql       — model_swap_events, value_for_money_feedback
├── api/
│   └── src/
│       └── routes/
│           ├── stories-swap-model.ts                    — POST /api/stories/:id/swap-model
│           ├── stories-vfm.ts                           — POST /api/stories/:id/value-for-money
│           └── admin.ts                                 — GET /api/admin/{spend-over-time, model-leaderboard, awaiting-feedback, stories-table}
└── web/
    └── src/
        ├── pages/
        │   └── admin.tsx                                — single admin page composing four sections
        └── components/
            ├── swap-model-modal.tsx                     — chip list + text input, blocks until reason present
            ├── admin-spend-chart.tsx
            ├── admin-stories-table.tsx
            ├── admin-model-leaderboard.tsx
            └── admin-awaiting-feedback-inbox.tsx        — row component with rating input + dictation-friendly textarea
```

### Files to modify

```
packages/
├── core/
│   └── src/
│       └── db/
│           └── schema.ts                                — add modelSwapEvents, valueForMoneyFeedback tables
└── web/
    └── src/
        ├── app.tsx                                      — register /admin route
        └── pages/
            └── story-reader.tsx                         — add "swap model and rerun" button per stage with output; add "rate value-for-money" link
```

Do not change: runner, cost recorder, model_catalog, model_calls schema, sync-catalog, /api/models endpoint, story-detail cost block, story-list cost column, new-story form, hardcoded constants (all from prior phases).

### Data model changes

**New tables (single migration, generated via drizzle-kit, applied via `npm run db:migrate`):**

`model_swap_events`
- id serial primary key
- story_id integer references stories(id)
- stage text not null
- from_model text references model_catalog(id)
- to_model text references model_catalog(id)
- reason_chip text (one of `too_verbose`, `broke_format`, `boring_prose`, `too_slow`, `failed`, `other`)
- reason_text text
- created_at timestamp default now()
- check (reason_chip is not null or coalesce(length(reason_text), 0) > 0)

`value_for_money_feedback`
- id serial primary key
- story_id integer references stories(id) unique
- rating integer not null check (rating between 1 and 5)
- note text
- created_at timestamp default now()

### Implementation order

1. `/tdd deriveJoyPerDollar` — covers SCENARIO 4
2. `/tdd derivePlanIterationsPerModel` — covers SCENARIO 4
3. `/tdd deriveSwapRatePerModel` — covers SCENARIO 4
4. `/tdd deriveTokensPerChar` — covers SCENARIO 4
5. `/tdd deriveFreeTierCompletionRate` — covers SCENARIO 4
6. `/tdd deriveAwaitingFeedbackInbox` — covers SCENARIO 4, 5
7. `/tdd deriveSpendOverTime` — covers SCENARIO 4
8. `/tdd deriveStoriesTable` — covers SCENARIO 4
9. Generate drizzle migration for `model_swap_events` + `value_for_money_feedback`; run `npm run db:migrate`
10. Implement `POST /api/stories/:id/swap-model`: writes swap event row + updates run_snapshots.<stage>Model + dispatches rerun in one transaction (rerun trigger = post-commit job). Validates reason_chip OR reason_text present. — covers SCENARIO 3
11. Implement `POST /api/stories/:id/value-for-money`: writes VFM row, validates rating in [1,5]. — covers SCENARIO 5
12. Implement `GET /api/admin/spend-over-time`, `model-leaderboard`, `awaiting-feedback`, `stories-table` — thin wrappers over derivers. — covers SCENARIO 4
13. Build web components: `swap-model-modal.tsx`, admin section components, inbox row component
14. Add "swap model and rerun" button to `story-reader.tsx` (visible only on stages with output)
15. Add "rate value-for-money" link to `story-reader.tsx`
16. Build `/admin` page composing the four sections
17. Register `/admin` route in `app.tsx`
18. Smoke-test: swap a model with reason → verify `model_swap_events` row + run_snapshots updated + stage rerun fires; mark a story `read` → it appears in inbox; submit VFM rating → it disappears from inbox; open `/admin`, verify charts populate.

### Scope boundary

- **In scope**: mid-pipeline swap (modal + endpoint + transaction), VFM rating + inbox, `/admin` dashboard with all four sections, eight leaderboard derivers, two new tables.
- **Out of scope (Phase 1, 2 — already shipped)**: runner, cost recording, catalog sync, hardcoded-constant removal, per-story override picker, story-detail cost block, GET /api/models, derivePerStageModels, deriveStructuredRequestPayload, deriveCatalogSyncDiff, deriveStoryCostBreakdown.
- **Out of scope (separate tasks)**: disabling critics, hard budget caps, multi-tenant auth on `/admin`, real-time cost streaming.
