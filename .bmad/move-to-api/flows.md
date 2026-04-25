---
type: flows
branch: main
task: move-to-api
state: confirmed
updated: 2026-04-25
---

# Key Flows: Move from Claude Agent SDK to OpenRouter

## Flow A — Story creation lifecycle (cost-aware)

```
Browser                 API                     Core/Orchestrator        OpenRouterRunner       OpenRouter API        Postgres
   │                      │                            │                        │                       │                   │
   ├─POST /stories───────►│                            │                        │                       │                   │
   │  (seed, perStage     │                            │                        │                       │                   │
   │   model overrides)   │                            │                        │                       │                   │
   │                      ├─resolvePerStageModels─────►│                        │                       │                   │
   │                      │  (universe defaults +      │                        │                       │                   │
   │                      │   per-story overrides)     │                        │                       │                   │
   │                      │                            ├─runPlotter────────────►│                       │                   │
   │                      │                            │                        ├─POST /chat/completions►                   │
   │                      │                            │                        │  (stream:true)        │                   │
   │                      │                            │                        │◄─────SSE chunks───────┤                   │
   │                      │                            │                        ├─CostRecorder.write────────────────────────►│
   │                      │                            │                        │  (model_calls row)    │                   │
   │                      │◄─plan + cost row written───┤                        │                       │                   │
   │                      │   (then critic, writer,    │                        │                       │                   │
   │                      │    text critic, …)         │                        │                       │                   │
   │                      │                            │                        │                       │                   │
   │                      │  (on stage failure: retry once with fallback model from same agentOverrides)│                   │
   │                      │                            │                        │                       │                   │
   │◄─SSE story progress──┤                            │                        │                       │                   │
   │                      │                            │                        │                       │                   │
   │  status=ready        │                            │                        │                       │                   │
```

**Numbered steps:**
1. Browser POSTs `/stories` with seed and optional per-stage model overrides.
2. API resolves the per-stage model + fallback map: universe defaults from `storyGroups.agentOverrides`, overlaid by per-story overrides from the payload. Result is the existing `PipelineModels` shape extended with `<stage>Fallback`.
3. Orchestrator runs each stage by calling the existing stage functions, which call `aiRunner.runText` or `aiRunner.runStructured` exactly as today.
4. `OpenRouterRunner` wraps each call: builds the OpenRouter HTTP request, streams chunks back via SSE for `runText`, awaits the JSON for `runStructured`. On a retryable failure, retries on the stage's fallback model.
5. After every successful (or terminally failed) call, `CostRecorder` inserts a row in `model_calls` with story_id, stage, model_id, tokens_in, tokens_out, usd, latency_ms, success, attempt, fallback_used.
6. Story progress streams to the browser via the existing SSE story endpoint.

## Flow B — Mid-pipeline model swap

```
Browser                       API                         Orchestrator                     Postgres
   │                            │                              │                                │
   ├─click "swap model"────────►│                              │                                │
   │  modal opens               │                              │                                │
   ├─POST /stories/:id/swap────►│                              │                                │
   │  {stage, to_model,         │                              │                                │
   │   reason_chip, reason_text}│                              │                                │
   │                            ├─INSERT model_swap_events─────────────────────────────────────►│
   │                            ├─trigger stage rerun─────────►│                                │
   │                            │                              ├─runStage(to_model)────────────►(via runner)
   │                            │                              ├─UPDATE run_snapshots.<stage>──►│
   │                            │                              ├─INSERT model_calls (rerun)────►│
   │◄─SSE updated stage output──┤                              │                                │
```

**Numbered steps:**
1. Browser sends swap request with stage, target model, reason chip, optional reason text. Endpoint validates that at least one reason field is non-empty.
2. API inserts a `model_swap_events` row.
3. Orchestrator reruns the named stage with the new model. Downstream stages are not auto-rerun (user re-triggers downstream manually if desired).
4. `run_snapshots.<stage>Model` is updated to the new model id.
5. New `model_calls` row(s) for the rerun attempt are recorded; both the original and rerun appear on the story-detail page with the swap reason inline.

## Flow C — Catalog sync (daily)

```
Cron tick ──► syncOpenRouterCatalog ──► GET /api/v1/models (OpenRouter)
                       │
                       ├─upsert model_catalog rows (preserving manual annotations)
                       └─soft-delete rows whose id no longer appears upstream
```

**Numbered steps:**
1. Daily scheduler (existing queue mechanism) invokes `syncOpenRouterCatalog`.
2. Job fetches the upstream catalog.
3. For each upstream model: upsert by id, preserving any manually-set columns (`is_recommended_for_prose`, etc.) on existing rows.
4. For any model_catalog row not present upstream: set `deleted_at = now()`. Conversely, clear `deleted_at` for any row that reappears.
5. Picker reads only rows where `deleted_at IS NULL`. Story-detail page resolves model name from any row regardless of `deleted_at`.
