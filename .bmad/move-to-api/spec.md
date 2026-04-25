---
type: spec
branch: main
task: move-to-api
state: superseded
phases-skipped: []
updated: 2026-04-25
superseded-by:
  - move-to-api-1-runner
  - move-to-api-2-overrides-cost
  - move-to-api-3-admin-feedback
note: See SUPERSEDED.md. preflight.md and flows.md in this folder remain the canonical reference for OpenRouter API contracts and assumptions; the three follow-on plans cite them rather than duplicate.
---

# Spec: Move from Claude Agent SDK to OpenRouter

### Derivers (mandatory)

| Deriver | Inputs | Output | Scenarios covered |
|---------|--------|--------|-------------------|
| `derivePerStageModels` | universeAgentOverrides (jsonb), perStoryOverrides (partial map), defaultFallbackMap | `{ <stage>: { model, fallback } }` for plotter, plotCritic, writer, writerCritic, psychologistPlan, psychologistText, plotterQuestions, improver, titleGenerator, storyAnalyzer, universeFactExtractor, feedbackSynthesizer, styleGuideUpdater, universeContextUpdater | SCENARIO 1, 2 |
| `deriveStoryCostBreakdown` | rows from `model_calls` for one story, rows from `model_swap_events` for one story | `{ totalUsd, perStage: [{ stage, model, attempt, tokensIn, tokensOut, usd, swapReason? }] }` | SCENARIO 6 |
| `deriveJoyPerDollar` | joined rows of (story, parentReviews.rating, childReactions.enjoyed, sum(model_calls.usd)), groupBy = model id appearing in any stage | `[{ model, avgJoyPerDollar, sampleSize }]`; null when total_usd = 0 | SCENARIO 4 |
| `derivePlanIterationsPerModel` | rows of (storyId, plotterModel, planIterations) | `[{ model, avgPlanIterations, sampleSize }]` | SCENARIO 4 |
| `deriveSwapRatePerModel` | rows from `model_swap_events`, rows of (storyId, all stage models used) | `[{ model, swapsAway, totalUses, swapRate }]` | SCENARIO 4 |
| `deriveTokensPerChar` | rows of (model, sum tokens_out, sum length(stage output text)) | `[{ model, tokensPerChar }]` | SCENARIO 4 |
| `deriveFreeTierCompletionRate` | all stories, all `model_calls` rows | `{ rate, freeOnlyStoryCount, totalStoryCount }` | SCENARIO 4 |
| `deriveAwaitingFeedbackInbox` | stories with status in ('ready','read'), value_for_money_feedback rows | list of stories without a feedback row, ordered by ready_at desc | SCENARIO 4, 5 |
| `deriveCatalogSyncDiff` | upstreamModelList, current model_catalog rows | `{ toUpsert, toSoftDelete, toUndelete }` | SCENARIO 7 |
| `deriveStructuredRequestPayload` | model id, modelCatalogRow.supports_json_schema, prompt, zodSchema | OpenRouter request body (with or without response_format; with appended JSON-only system instruction in fallback path) | SCENARIO 8 |

Each deriver is a pure function in `packages/core/src/cost/aggregations/` (for the leaderboard ones) or `packages/core/src/openrouter/` (for the request-shaping ones) or `packages/core/src/pipeline/derivers/` (for `derivePerStageModels`). All testable with synthetic input rows; no DB or HTTP.

### Files to create

```
packages/
├── core/
│   └── src/
│       ├── openrouter/
│       │   ├── openrouter.client.ts                     — HTTP + SSE wrapper for /chat/completions and /models
│       │   ├── openrouter.runner.ts                     — implements AiRunner; streaming runText, json_schema-aware runStructured
│       │   ├── openrouter.runner.test.ts                — happy path, fallback on 429, structured fallback path
│       │   ├── derive-structured-request-payload.ts     — pure deriver
│       │   ├── derive-structured-request-payload.test.ts
│       │   └── sync-catalog.ts                          — daily job: fetch /models, upsert, soft-delete
│       ├── cost/
│       │   ├── cost-recorder.ts                         — writes model_calls rows
│       │   ├── cost-recorder.test.ts
│       │   └── aggregations/
│       │       ├── derive-story-cost-breakdown.ts
│       │       ├── derive-story-cost-breakdown.test.ts
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
│       │       └── derive-awaiting-feedback-inbox.test.ts
│       ├── pipeline/
│       │   └── derivers/
│       │       ├── per-stage-models.ts                  — derivePerStageModels
│       │       └── per-stage-models.test.ts
│       └── db/
│           └── migrations/
│               └── <next>_openrouter_cost_tracking.sql  — model_catalog, model_calls, model_swap_events, value_for_money_feedback
├── api/
│   └── src/
│       └── routes/
│           ├── models.ts                                — GET /api/models (catalog, filtered)
│           ├── stories-swap-model.ts                    — POST /api/stories/:id/swap-model
│           ├── stories-vfm.ts                           — POST /api/stories/:id/value-for-money
│           └── admin.ts                                 — GET /api/admin/{spend-over-time,model-leaderboard,awaiting-feedback,stories-table}
└── web/
    └── src/
        ├── pages/
        │   └── admin.tsx                                — single admin page with the four sections
        └── components/
            ├── model-picker.tsx                         — per-stage dropdown + fallback dropdown + filters
            └── swap-model-modal.tsx                     — chip list + text input, blocks until reason present
```

### Files to modify

```
packages/
├── core/
│   ├── package.json                                     — remove @anthropic-ai/claude-agent-sdk; add nothing (use fetch + EventSource polyfill if needed in node)
│   └── src/
│       ├── ai/
│       │   ├── index.ts                                 — export OpenRouterRunner instance as the default; remove ClaudeCliRunner export
│       │   ├── claude-cli.runner.ts                     — DELETE; the helpers parseJsonWithSchema/jsonCandidates/extractBalancedObject move to openrouter/json-extract.ts (preserved verbatim)
│       │   └── claude-cli.runner.test.ts                — DELETE
│       └── pipeline/
│           ├── orchestrator.ts                          — pass per-stage fallback alongside model; no change to call shape
│           ├── feedback-synthesizer.ts                  — replace hardcoded SYNTHESIZER_MODEL with universe lookup
│           ├── universe-context-updater.ts              — replace hardcoded MODEL with universe lookup
│           ├── style-guide-updater.ts                   — replace hardcoded MODEL with universe lookup
│           └── stages/
│               ├── universe-fact-extractor.ts           — replace hardcoded MODEL with universe lookup
│               ├── story-analyzer.ts                    — replace hardcoded MODEL with universe lookup
│               └── improver.ts                          — replace IMPROVER_MODEL with universe lookup
└── web/
    └── src/
        ├── app.tsx                                      — register /admin route
        └── pages/
            ├── story-list.tsx                           — column for total USD when present
            └── story-reader.tsx                         — cost-summary block when status=ready and model_calls exist; "rate value-for-money" link to /admin inbox
```

Do not change: existing tests for non-AI logic, drizzle migrations runner script, queue infrastructure, prompt-resolver behavior, run_snapshots schema (cost rolls up via join, no new columns there).

### Data model changes

**New tables (single migration generated via drizzle-kit, applied via `npm run db:migrate`):**

`model_catalog`
- id text primary key (OpenRouter model id, e.g. `anthropic/claude-3.5-sonnet`)
- name text not null
- input_usd_per_million numeric
- output_usd_per_million numeric
- context_length integer
- supports_json_schema boolean default false
- is_free boolean default false
- is_recommended_for_prose boolean default false (manual annotation)
- last_synced_at timestamp
- deleted_at timestamp null

`model_calls`
- id serial primary key
- story_id integer references stories(id)
- stage text not null (e.g. `plotter`, `writer`, `psychologist_plan`)
- model_id text references model_catalog(id) (no cascade — preserve historic)
- attempt integer not null default 1
- fallback_used boolean not null default false
- tokens_in integer
- tokens_out integer
- usd numeric not null default 0
- latency_ms integer
- success boolean not null
- created_at timestamp default now()

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

**Schema changes to existing tables:** none. `storyGroups.agentOverrides` is already `jsonb` and absorbs the new `{ <stage>: { model, fallback } }` shape with no migration.

**External API contract**: OpenRouter Chat Completions request/response and Models endpoint as documented in `preflight.md`.

### Implementation order

1. `/tdd derivePerStageModels` — covers SCENARIO 1, 2
2. `/tdd deriveStructuredRequestPayload` — covers SCENARIO 8
3. `/tdd deriveCatalogSyncDiff` — covers SCENARIO 7
4. `/tdd deriveStoryCostBreakdown` — covers SCENARIO 6
5. `/tdd deriveJoyPerDollar` — covers SCENARIO 4
6. `/tdd derivePlanIterationsPerModel` — covers SCENARIO 4
7. `/tdd deriveSwapRatePerModel` — covers SCENARIO 4
8. `/tdd deriveTokensPerChar` — covers SCENARIO 4
9. `/tdd deriveFreeTierCompletionRate` — covers SCENARIO 4
10. `/tdd deriveAwaitingFeedbackInbox` — covers SCENARIO 4, 5
11. Generate drizzle migration for the four new tables; run `npm run db:migrate`
12. Implement `OpenRouterClient` (HTTP + SSE) and `OpenRouterRunner` (preserves AiRunner interface) — wires SCENARIO 1, 8 via runner unit tests
13. Implement `CostRecorder` and integrate into the runner so every call writes a `model_calls` row — wires SCENARIO 1
14. Wire fallback retry inside the runner (preferred → fallback on retryable error) — wires SCENARIO 1 fallback behavior
15. Replace hardcoded model constants in `feedback-synthesizer.ts`, `universe-context-updater.ts`, `style-guide-updater.ts`, `universe-fact-extractor.ts`, `story-analyzer.ts`, `improver.ts` with per-universe lookups using `derivePerStageModels`
16. Swap singleton in `ai/index.ts` to `OpenRouterRunner`; delete `claude-cli.runner.ts` and tests; remove `@anthropic-ai/claude-agent-sdk` from `packages/core/package.json`
17. Add `sync-catalog.ts` job and register on the existing scheduler — wires SCENARIO 7
18. Add API routes: GET /api/models; POST /api/stories/:id/swap-model; POST /api/stories/:id/value-for-money; GET /api/admin/* — wires SCENARIO 2, 3, 4, 5
19. Add web components: `model-picker.tsx`, `swap-model-modal.tsx`, cost-summary block in `story-reader.tsx`, cost column in `story-list.tsx` — wires SCENARIO 2, 3, 6
20. Add `/admin` page with four sections — wires SCENARIO 4, 5
21. Smoke-test end-to-end: create a story with default models, verify cost row appears, swap a model with reason, verify swap event logged, mark read, verify story appears in inbox, submit VFM rating, verify it disappears from inbox

### Scope boundary

- **Out of scope**: disabling the plot-critic / writer-critic loops (separate task). Critics keep running through the new runner identically to other stages.
- **Out of scope**: hard budget caps. v1 is visibility only.
- **Out of scope**: backfilling cost for pre-OpenRouter stories. They render with "—".
- **Out of scope**: multi-tenant auth on `/admin`. Single-user trust boundary.
- **Out of scope**: per-environment OpenRouter keys. One env var, single environment.
- **Out of scope**: real-time streaming of cost-as-it-accrues to the UI. Cost shows once the call completes.
