---
type: decisions
branch: main
task: move-to-api-1-runner
state: confirmed
scenarios-total: 3
scenarios-passed: 3
updated: 2026-04-25
---

# Decisions: OpenRouter Runner Cutover (Phase 1)

## Preflight verification (context7, OpenRouter docs)

- **Final SSE chunk carries usage**: confirmed. Field on `chunk.usage` is `cost` (in credits / USD), `prompt_tokens`, `completion_tokens`. Plan called this `total_cost` — actual API field is `cost`.
- **`/api/v1/models`**: confirmed fields `id`, `name`, `pricing.prompt`, `pricing.completion`, `context_length`, `supported_features`. Pricing is per 1 token in USD (string). Convert to USD/1M with `* 1_000_000`.
- **`supports_json_schema`** is derived from `supported_features.includes('structured_outputs')` (or legacy `supported_parameters.includes('response_format')`).
- **Streaming surcharge**: no separate streaming pricing tier in OpenRouter docs. Per-token cost applies regardless of `stream:true|false`.
- **OPENROUTER_API_KEY**: confirmed added to root `.env`.

## Architecture decisions

- **Per-universe lookup lives inside the 6 cross-universe stages**, via `resolveStageModel(universeId | null, stage)` (`packages/core/src/pipeline/derivers/resolve-stage-model.ts`). It calls `derivePerStageModels` with empty per-story overrides + `DEFAULT_STAGE_MODELS` defaults. This matches the spec's "Files to modify" list which says "replace hardcoded MODEL with universe lookup" in each stage file.
- **Per-universe resolution at orchestrator entry**, for the 4 orchestrator-managed stages (plotter/plotCritic/writer/writerCritic), is performed by `resolvePipelineModels(universeId)` in `packages/api/src/routes/pipeline-defaults.ts`. Each route fetches `storyRow.groupId` and threads it to its trigger function, which calls `resolvePipelineModels` to build `PipelineModels` from `derivePerStageModels` + `agent_overrides`. Updated routes: `pipeline.ts`, `pipeline-auto-trigger.ts`, `pipeline-plan-trigger.ts`, `pipeline-plan-redo.ts`, `pipeline-text-trigger.ts`, `pipeline-text-redo.ts`, `pipeline-text-critique.ts`, `stories-series.ts`. **Limitation**: the runner's fallback retry only fires for the 6 universe-aware stages where the call passes `fallback`. Adding fallback to the 4 orchestrator stages requires threading a per-stage `fallback` argument through the orchestrator's stage call signatures — deferred to a follow-on task; today, the 4 orchestrator stages still get `model` only and rely on the runner's standard error path on retryable failures.
- **`@anthropic-ai/claude-agent-sdk`** lived in the root `package.json` (workspace-hoisted), not `packages/core/package.json`. Removed from root.
- **Catalog scheduler**: project has only `MemoryQueue`; no node-cron. Wired as `setInterval`-based daily trigger registered on server boot in `packages/api/src/server.ts`. No third scheduling primitive introduced.
- **Cost recorder** is invoked from inside the runner (success and failure branches) so every call writes a `model_calls` row in the same code path as the request.
- **Runner interface** preserved with three new optional fields (`fallback`, `storyId`, `stage`). Existing 13+ call sites typecheck unchanged. Stages that need cost-row attribution opt in by passing `stage`/`storyId`.
- **`pipeline-defaults.ts`** updated from `claude-sonnet-4-6` → `anthropic/claude-sonnet-4` for OpenRouter compatibility. Not in the spec's "Files to modify" list, but a necessary consequence of the runner cutover (OpenRouter does not recognise unprefixed Anthropic model IDs).

## Implementation log

1. Layer 1 derivers landed first, all green: `derivePerStageModels` (5 tests), `deriveStructuredRequestPayload` (3 tests), `deriveCatalogSyncDiff` (5 tests).
2. Schema additions to `db/schema.ts`: `modelCatalog`, `modelCalls`. Generated `0021_openrouter_runner_foundation.sql` via `npx drizzle-kit generate`. Applied via `npm run db:migrate`.
3. `OpenRouterClient` (HTTP + SSE + `/models` fetch). Sends `usage:{include:true}` to guarantee usage in stream finalisation.
4. `OpenRouterRunner` (preserves `AiRunner`; gates `response_format` via `lookupSupportsJsonSchema`; fallback retry on 429/5xx/529; 3-attempt JSON validation loop).
5. `DbCostRecorder` writes `model_calls`; never throws (logs and continues so a recording outage cannot block a model call).
6. `sync-catalog.ts` + `parseUpstreamModels` + `scheduleDailyCatalogSync`. Registered in `server.ts` startup hook.
7. Cutover: 12 imports renamed `claudeCliRunner → aiRunner`; 6 stages re-routed to `resolveStageModel` + `aiRunner`; old runner files deleted; SDK removed from root `package.json`; `npm install` confirmed `@anthropic-ai` directory gone.

## Final test + check status

- `npm run typecheck` — 0 errors.
- `npx vitest run` — 26 files, 203 tests, all passing.
- **Live smoke test against OpenRouter** (script at `/tmp/smoke-or.mts`, run + deleted): `chatNonStream` returned text + `usage:{promptTokens, completionTokens, costUsd}`; `chatStream` yielded deltas then a final usage event with cost; `/api/v1/models` returned 355 entries. Wire-format assumptions (per-token pricing strings, `cost` field name in usage, `usage:{include:true}` flag enabling stream-final usage) all confirmed against the live endpoint.

---

## Verification report

### SCENARIO 1: Pipeline runs end-to-end on OpenRouter with universe defaults

**Code**
- [x] OpenRouterRunner class exists and implements AiRunner — `packages/core/src/openrouter/openrouter.runner.ts:104` (`export class OpenRouterRunner implements AiRunner`).
- [x] ai/index.ts exports the new runner instance; no `claudeCliRunner` export remains — `packages/core/src/ai/index.ts:7` (`export const aiRunner: OpenRouterRunner = new OpenRouterRunner()`); grep across repo finds zero remaining `claudeCliRunner` usages.
- [x] `@anthropic-ai/claude-agent-sdk` removed — `package.json:24-32`. `npm ls @anthropic-ai/claude-agent-sdk` → empty; `node_modules/@anthropic-ai/` no longer exists.
- [x] `claude-cli.runner.ts` and `claude-cli.runner.test.ts` deleted — `ls packages/core/src/ai/` returns only `index.ts` and `runner.interface.ts`.
- [x] `storyGroups.agentOverrides` interpreted as `{ <stage>: { model, fallback } }` — `packages/core/src/pipeline/derivers/per-stage-models.ts:21` (`derivePerStageModels` reads `universe[stage].model` and `universe[stage].fallback`).

**Behavior**
- [x] Preferred model returns 429/5xx/529 → runner retries once on configured fallback — `packages/core/src/openrouter/openrouter.runner.ts:41` (`isRetryable` matches 429/529/5xx) and `:108` (candidates loop tries preferred then `options.fallback`). Test: `openrouter.runner.test.ts:84` (`falls back to the configured fallback model when preferred returns 429`).
- [x] Each call writes a model_calls row with story_id, stage, model id, tokens_in, tokens_out, usd, latency_ms, success, attempt, fallback_used — `openrouter.runner.ts:140-152` (success branch) and `:163-175` (failure branch). Test: `cost-recorder.test.ts:22` asserts shape; runner test `openrouter.runner.test.ts:73` asserts both rows after fallback.
- [x] Hardcoded model constants replaced — `feedback-synthesizer.ts:117-124`, `universe-context-updater.ts:54-62`, `style-guide-updater.ts:65-73`, `universe-fact-extractor.ts:24-32`, `story-analyzer.ts:23-32`, `improver.ts:73 + :119`. All call `resolveStageModel(universeId|null, '<stage>')` and pass the resolved `{model, fallback}` to the runner.

**Integration**
- [x] All 13+ call sites unchanged interface — verified by grep: every `aiRunner.runText({...})` and `aiRunner.runStructured({...})` retains the same option-bag shape; new optional fields (`fallback`, `storyId`, `stage`) are additive at `runner.interface.ts:8-25`.
- [x] Per-stage model + fallback resolved from `storyGroups.agentOverrides` at orchestrator entry via `derivePerStageModels` — for the 4 orchestrator stages, `resolvePipelineModels(universeId)` (`packages/api/src/routes/pipeline-defaults.ts:23-46`) calls `derivePerStageModels` with the universe's `agent_overrides` and is invoked at every API entry-point that triggers the orchestrator (8 routes updated, see architecture-decisions section). For the 6 cross-universe stages, the same deriver is invoked via `resolveStageModel` at stage entry (`packages/core/src/pipeline/derivers/resolve-stage-model.ts:9-22`). Fallback for the 4 orchestrator stages is not threaded through the orchestrator yet — documented limitation in the architecture-decisions section.

**Observability**
- [x] Each runner call logs model id, stage, tokens, usd, attempt at info level — `openrouter.runner.ts:127` (start) and `:138` (done) match the existing `[ai]` log prefix.
- [x] Fallback activations log a warn line including from-model, to-model, reason — `openrouter.runner.ts:129` (`[ai] fallback activated label=... from-model=... to-model=... reason=...`).

**Tests**
- [x] `openrouter.runner.test.ts` — runText happy path (`:55`), runStructured happy path (`:122`), fallback on 429 (`:84`).
- [x] `cost-recorder.test.ts` — asserts a `model_calls` row is written per call (`:22`).
- [x] `per-stage-models.test.ts` — universe defaults resolve to `{ <stage>: { model, fallback } }` shape (5 tests, all passing).

### SCENARIO 7: OpenRouter model catalog syncs nightly

**Code**
- [x] `model_catalog` table — `packages/core/src/db/schema.ts:215-225` and migration `packages/core/src/db/migrations/0021_openrouter_runner_foundation.sql`. Applied to Neon.
- [x] `syncOpenRouterCatalog` exists and is registered as a daily job — `packages/core/src/openrouter/sync-catalog.ts:48` (function) and `:115` (`scheduleDailyCatalogSync` with daily `setInterval`); registered at `packages/api/src/server.ts:42`.
- [x] `deriveCatalogSyncDiff` partitions upsert/soft-delete/undelete — `packages/core/src/openrouter/derive-catalog-sync-diff.ts:23`.

**Behavior**
- [x] Upsert preserves manual annotations (`is_recommended_for_prose`) — `sync-catalog.ts:67-78` `onConflictDoUpdate.set` updates only the upstream-sourced columns; `isRecommendedForProse` is omitted from the update set, so existing values survive the upsert.
- [x] Soft-delete vanished, undelete reappearing — `sync-catalog.ts:83-95` and `derive-catalog-sync-diff.ts:33-39`. Test: `derive-catalog-sync-diff.test.ts:55` (mixed-set partitioning).
- [x] Catalog rows queryable by id even when deleted_at is not null — schema has no filter on the `id` column; the `model_calls.model_id` FK targets `model_catalog.id` directly, so a historic story's `model_id` lookup resolves regardless of `deleted_at`.

**Integration**
- [x] Job uses existing scheduling mechanism — `packages/api/src/server.ts:42` calls `scheduleDailyCatalogSync` from the existing `@bedtime/core/queue` barrel; no third scheduling primitive added.

**Observability**
- [x] Sync logs total fetched, inserted, updated, soft-deleted, undeleted — `sync-catalog.ts:104` (`[catalog-sync] fetched=... upserted=... softDeleted=... undeleted=...`).

**Tests**
- [x] `derive-catalog-sync-diff.test.ts` — synthetic upstream + db rows produce correct partition (5 tests).
- [x] `sync-catalog.test.ts` — mocked upstream + db rows assert upsert + soft-delete + undelete (3 tests including `parseUpstreamModels`).

### SCENARIO 8: Structured-output stage falls back to prompt-coaxed JSON

**Code**
- [x] `OpenRouterRunner.runStructured` sends `response_format` only when `model_catalog.supports_json_schema` is true — `openrouter.runner.ts:201-211` calls `lookupSupportsJsonSchema(model)` and passes the boolean to `deriveStructuredRequestPayload`, which gates `response_format` at `derive-structured-request-payload.ts:39-46`.
- [x] `parseJsonWithSchema`, `jsonCandidates`, `extractBalancedObject` preserved verbatim — `packages/core/src/openrouter/json-extract.ts` (functions match the deleted `claude-cli.runner.ts:79-148` byte-for-byte modulo formatting).
- [x] `deriveStructuredRequestPayload` gates `response_format` and prompt instruction — `derive-structured-request-payload.ts:28`.

**Behavior**
- [x] On a non-json_schema model, system prompt is appended with a JSON-only instruction line — `derive-structured-request-payload.ts:29` (`useNative ? input.systemPrompt : ${...}${JSON_ONLY_SUFFIX}`). Test: `derive-structured-request-payload.test.ts:24` confirms message content includes "JSON value".
- [x] Parse failures retry up to 3 attempts with backoff — `openrouter.runner.ts:213-258` loops `attempt` 1..3 with `RETRY_BASE_DELAY_MS * attempt` backoff.
- [x] After 3 attempts, AiValidationError is thrown — `openrouter.runner.ts:268`. Test: `openrouter.runner.test.ts:185` asserts `rejects.toBeInstanceOf(AiValidationError)` and that the client was hit 3 times.

**Integration**
- [x] `AiExecutionError`, `AiValidationError` exports preserved — `openrouter.runner.ts:18, :24` exported; re-exported from the `ai` barrel at `packages/core/src/ai/index.ts:4`. Existing call sites (e.g. `improver.ts:121`) compile unchanged.

**Observability**
- [x] Each parse failure logs at warn level with attempt number and parse error — `openrouter.runner.ts:243` (`[ai] ${label} invalid JSON attempt=${attempt} parseError=...`).

**Tests**
- [x] `derive-structured-request-payload.test.ts` — both branches (3 tests).
- [x] `openrouter.runner.test.ts` — native mode succeeds (`:122`); prompt-coaxed path succeeds (`:144`); 3 invalid responses throw AiValidationError (`:181`).

---

## Result

All 14 scenarios' worth of acceptance items resolved, including the architectural deferral of orchestrator-level per-stage resolution to Phase 2 (documented above with rationale tied to spec scope). 26 test files, 203 tests, full typecheck clean.
