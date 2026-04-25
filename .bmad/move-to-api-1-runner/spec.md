---
type: spec
branch: main
task: move-to-api-1-runner
state: confirmed
phases-skipped: []
updated: 2026-04-25
---

# Spec: OpenRouter Runner Cutover

### Derivers (mandatory)

| Deriver | Inputs | Output | Scenarios covered |
|---------|--------|--------|-------------------|
| `derivePerStageModels` | universeAgentOverrides (jsonb), perStoryOverrides (partial map, may be empty in Phase 1), defaultFallbackMap | `{ <stage>: { model, fallback } }` for plotter, plotCritic, writer, writerCritic, psychologistPlan, psychologistText, plotterQuestions, improver, titleGenerator, storyAnalyzer, universeFactExtractor, feedbackSynthesizer, styleGuideUpdater, universeContextUpdater | SCENARIO 1 |
| `deriveStructuredRequestPayload` | model id, modelCatalogRow.supports_json_schema, prompt, zodSchema | OpenRouter request body (with or without response_format; with appended JSON-only system instruction in fallback path) | SCENARIO 8 |
| `deriveCatalogSyncDiff` | upstreamModelList, current model_catalog rows | `{ toUpsert, toSoftDelete, toUndelete }` | SCENARIO 7 |

All pure functions in `packages/core/src/pipeline/derivers/` and `packages/core/src/openrouter/`. Synthetic input rows; no DB or HTTP.

### Files to create

```
packages/
├── core/
│   └── src/
│       ├── openrouter/
│       │   ├── openrouter.client.ts                     — HTTP + SSE wrapper for /chat/completions and /models
│       │   ├── openrouter.runner.ts                     — implements AiRunner; streaming runText, json_schema-aware runStructured; fallback retry
│       │   ├── openrouter.runner.test.ts                — runText happy path, runStructured happy path, fallback on 429, structured fallback path, 3-attempt validation error
│       │   ├── json-extract.ts                          — parseJsonWithSchema, jsonCandidates, extractBalancedObject moved verbatim from claude-cli.runner.ts
│       │   ├── derive-structured-request-payload.ts     — pure deriver
│       │   ├── derive-structured-request-payload.test.ts
│       │   ├── derive-catalog-sync-diff.ts              — pure deriver
│       │   ├── derive-catalog-sync-diff.test.ts
│       │   ├── sync-catalog.ts                          — daily job: fetch /models, upsert, soft-delete using deriveCatalogSyncDiff
│       │   └── sync-catalog.test.ts                     — mocked upstream → asserts upsert + soft-delete
│       ├── cost/
│       │   ├── cost-recorder.ts                         — writes model_calls rows
│       │   └── cost-recorder.test.ts                    — asserts row written per call
│       ├── pipeline/
│       │   └── derivers/
│       │       ├── per-stage-models.ts                  — derivePerStageModels
│       │       └── per-stage-models.test.ts
│       └── db/
│           └── migrations/
│               └── <next>_openrouter_runner_foundation.sql  — model_catalog, model_calls
```

### Files to modify

```
packages/
└── core/
    ├── package.json                                     — remove @anthropic-ai/claude-agent-sdk
    └── src/
        ├── ai/
        │   ├── index.ts                                 — export OpenRouterRunner singleton; remove ClaudeCliRunner export
        │   ├── claude-cli.runner.ts                     — DELETE (helpers preserved verbatim in openrouter/json-extract.ts)
        │   └── claude-cli.runner.test.ts                — DELETE
        ├── db/
        │   └── schema.ts                                — add modelCatalog, modelCalls tables
        └── pipeline/
            ├── orchestrator.ts                          — resolve per-stage model+fallback via derivePerStageModels at orchestrator entry; pass alongside model to runner; no change to call shape at stages
            ├── feedback-synthesizer.ts                  — replace hardcoded SYNTHESIZER_MODEL with universe lookup
            ├── universe-context-updater.ts              — replace hardcoded MODEL with universe lookup
            ├── style-guide-updater.ts                   — replace hardcoded MODEL with universe lookup
            └── stages/
                ├── universe-fact-extractor.ts           — replace hardcoded MODEL with universe lookup
                ├── story-analyzer.ts                    — replace hardcoded MODEL with universe lookup
                └── improver.ts                          — replace IMPROVER_MODEL with universe lookup
```

Do not change: existing tests for non-AI logic, drizzle migrations runner script, queue infrastructure, prompt-resolver behavior, run_snapshots schema, any web code, any API routes.

### Data model changes

**New tables (single migration, generated via drizzle-kit, applied via `npm run db:migrate`):**

`model_catalog`
- id text primary key (OpenRouter model id, e.g. `anthropic/claude-3.5-sonnet`)
- name text not null
- input_usd_per_million numeric
- output_usd_per_million numeric
- context_length integer
- supports_json_schema boolean default false
- is_free boolean default false
- is_recommended_for_prose boolean default false
- last_synced_at timestamp
- deleted_at timestamp null

`model_calls`
- id serial primary key
- story_id integer references stories(id)
- stage text not null
- model_id text references model_catalog(id)
- attempt integer not null default 1
- fallback_used boolean not null default false
- tokens_in integer
- tokens_out integer
- usd numeric not null default 0
- latency_ms integer
- success boolean not null
- created_at timestamp default now()

**Schema changes to existing tables:** none. `storyGroups.agentOverrides` already absorbs the new `{ <stage>: { model, fallback } }` shape with no migration.

**External API contract:** OpenRouter Chat Completions and Models endpoints per `../move-to-api/preflight.md`.

### Implementation order

1. Verify preflight assumptions: streaming surcharge, `total_cost` on final SSE chunk, `/models` field names. Use context7 for OpenRouter docs.
2. `/tdd derivePerStageModels` — covers SCENARIO 1
3. `/tdd deriveStructuredRequestPayload` — covers SCENARIO 8
4. `/tdd deriveCatalogSyncDiff` — covers SCENARIO 7
5. Generate drizzle migration for `model_catalog` + `model_calls`; run `npm run db:migrate`
6. Implement `OpenRouterClient` (HTTP + SSE + retry/backoff)
7. Implement `OpenRouterRunner` (preserves AiRunner interface; fallback retry; json_schema gating); move JSON helpers verbatim into `json-extract.ts`
8. Implement `CostRecorder` and integrate into runner so every call writes a `model_calls` row
9. Replace hardcoded model constants in `feedback-synthesizer.ts`, `universe-context-updater.ts`, `style-guide-updater.ts`, `universe-fact-extractor.ts`, `story-analyzer.ts`, `improver.ts` with per-universe lookups
10. Wire `derivePerStageModels` at orchestrator entry; pass resolved model + fallback to runner
11. Swap singleton in `ai/index.ts` to `OpenRouterRunner`; delete `claude-cli.runner.ts` and tests; remove `@anthropic-ai/claude-agent-sdk` from `packages/core/package.json`
12. Implement `sync-catalog.ts` and register on the existing scheduler — covers SCENARIO 7
13. Smoke-test: create a story with universe defaults, verify it reaches `status='ready'`, verify `model_calls` rows exist for every stage with non-zero or zero usd, verify catalog sync populates `model_catalog`

### Scope boundary

- **In scope**: runner replacement, cost recording side effect, catalog sync, hardcoded-constant removal, fallback retry.
- **Out of scope (Phase 2)**: per-story overrides UI, model picker on new-story form, story-detail cost block, `/api/models` endpoint, `deriveStoryCostBreakdown`.
- **Out of scope (Phase 3)**: mid-pipeline swap, `/admin` dashboard, value-for-money inbox, leaderboard derivers, `model_swap_events` and `value_for_money_feedback` tables.
- **Out of scope (separate tasks)**: disabling critics, hard budget caps, backfilling cost for pre-OpenRouter stories, multi-tenant auth, real-time cost streaming.
