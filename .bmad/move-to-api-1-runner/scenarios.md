---
type: scenarios
branch: main
task: move-to-api-1-runner
state: confirmed
updated: 2026-04-25
---

# Scenarios: OpenRouter Runner Cutover

### SCENARIO 1: Pipeline runs end-to-end on OpenRouter with universe defaults
Type: business
Actor: parent (single user)

The parent creates a story without overriding any model. The pipeline runs each stage through OpenRouter, calling the universe's preferred model for that stage. When the preferred model returns a retryable error (429 / 5xx / 529), the runner switches to the configured fallback for that stage on a single retry. The story reaches `status='ready'`. Every model call (preferred and fallback) writes a `model_calls` row.

Acceptance:
  Code:
    [ ] OpenRouterRunner class exists in packages/core/src/openrouter/openrouter.runner.ts and implements AiRunner interface
    [ ] ai/index.ts exports OpenRouterRunner instance as the default runner; no claudeCliRunner export remains
    [ ] @anthropic-ai/claude-agent-sdk removed from packages/core/package.json
    [ ] claude-cli.runner.ts and claude-cli.runner.test.ts deleted
    [ ] storyGroups.agentOverrides interpreted as `{ <stage>: { model, fallback } }` by derivePerStageModels
  Behavior:
    [ ] Preferred model returns 429/5xx/529 → runner retries once on configured fallback
    [ ] Each model call (preferred or fallback) writes a row in model_calls with story_id, stage, model id, tokens_in, tokens_out, usd, latency_ms, success, attempt, fallback_used
    [ ] Hardcoded model constants in feedback-synthesizer.ts, universe-context-updater.ts, style-guide-updater.ts, universe-fact-extractor.ts, story-analyzer.ts, improver.ts replaced with universe lookups
  Integration:
    [ ] All thirteen call sites that today call claudeCliRunner.runText/runStructured call the new runner unchanged (interface preserved)
    [ ] Per-stage model + fallback resolved from storyGroups.agentOverrides at orchestrator entry via derivePerStageModels
  Observability:
    [ ] Each runner call logs model id, stage, tokens, usd, attempt at info level (matches current [ai] log format)
    [ ] Fallback activations log a warn line including from-model, to-model, reason
  Tests:
    [ ] openrouter.runner.test.ts asserts: runText happy path, runStructured happy path, fallback on 429
    [ ] cost-recorder.test.ts asserts a model_calls row is written per call
    [ ] per-stage-models.test.ts asserts universe defaults resolve to `{ <stage>: { model, fallback } }` shape

### SCENARIO 7: OpenRouter model catalog syncs nightly
Type: technical
Actor: scheduler

A scheduled job runs once per day, fetches `GET /api/v1/models` from OpenRouter, upserts every model into `model_catalog`, and soft-deletes any catalog row whose model id no longer appears upstream. Soft-deleted rows remain queryable so historic stories still resolve their model name.

Acceptance:
  Code:
    [ ] model_catalog table exists with id (pk), name, input_usd_per_million, output_usd_per_million, context_length, supports_json_schema, is_free, is_recommended_for_prose, deleted_at, last_synced_at
    [ ] syncOpenRouterCatalog function exists in packages/core/src/openrouter/sync-catalog.ts and is registered as a daily job
    [ ] deriveCatalogSyncDiff pure function computes upsert/soft-delete/undelete sets
  Behavior:
    [ ] Upsert preserves manual annotations (is_recommended_for_prose) on existing rows
    [ ] Models not present in upstream get deleted_at set; existing deleted_at rows are cleared (undeleted) if the model reappears
    [ ] Catalog rows are queryable by id even when deleted_at is not null (for historic story name resolution)
  Integration:
    [ ] Job uses the same node-cron / queue mechanism already in packages/core/src/queue/
  Observability:
    [ ] Sync logs: total fetched, inserted, updated, soft-deleted, undeleted
  Tests:
    [ ] derive-catalog-sync-diff.test.ts: synthetic upstream + db rows → correct upsert/soft-delete/undelete partition
    [ ] sync-catalog.test.ts: with mocked upstream response, asserts upsert + soft-delete + undelete behavior end-to-end against a test db (or in-memory fake)

### SCENARIO 8: Structured-output stage falls back to prompt-coaxed JSON when the model lacks json_schema
Type: technical
Actor: pipeline

A structured-output stage runs on a model whose `supports_json_schema` flag is false. The runner sends the request without `response_format`, the prompt instructs the model to emit JSON, the response text is run through the existing balanced-brace extractor + Zod validation, and the parsed value is returned. If parsing fails, retry-with-backoff kicks in (max 3 attempts).

Acceptance:
  Code:
    [ ] OpenRouterRunner.runStructured sends response_format only when model_catalog.supports_json_schema is true
    [ ] parseJsonWithSchema, jsonCandidates, extractBalancedObject helpers preserved verbatim in packages/core/src/openrouter/json-extract.ts
    [ ] deriveStructuredRequestPayload pure function gates response_format and prompt instruction
  Behavior:
    [ ] On a non-json_schema model, the system prompt is appended with a JSON-only instruction line
    [ ] Parse failures retry up to 3 attempts with the existing backoff schedule
    [ ] After 3 attempts, AiValidationError is thrown
  Integration:
    [ ] AiExecutionError, AiValidationError exports preserved (call sites depend on them)
  Observability:
    [ ] Each parse failure logs at warn level with attempt number and parse error
  Tests:
    [ ] derive-structured-request-payload.test.ts: supports_json_schema=true → request has response_format; false → no response_format and JSON-only instruction appended
    [ ] openrouter.runner.test.ts: model with supports_json_schema=true uses native mode and succeeds first try
    [ ] openrouter.runner.test.ts: model with supports_json_schema=false uses prompt-coaxed path and succeeds
    [ ] openrouter.runner.test.ts: 3 invalid responses throw AiValidationError
