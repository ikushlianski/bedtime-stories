---
type: scenarios
branch: main
task: move-to-api
state: superseded
updated: 2026-04-25
superseded-by:
  - move-to-api-1-runner   # SCENARIO 1, 7, 8
  - move-to-api-2-overrides-cost  # SCENARIO 2, 6
  - move-to-api-3-admin-feedback  # SCENARIO 3, 4, 5
---

# Scenarios: Move from Claude Agent SDK to OpenRouter

## Business Scenarios

### SCENARIO 1: User creates a story with universe defaults
Type: business
Actor: parent (single user)

The parent opens the new-story form, enters a seed, and accepts the universe's pre-selected model + fallback per stage without changing anything. The pipeline runs end-to-end via OpenRouter, calling each stage's preferred model and silently switching to the fallback model for that stage if the preferred one fails (rate limit / 5xx / free-tier exhausted). When the story reaches `status='ready'`, the story-detail page shows total USD spent and a per-stage breakdown.

Acceptance:
  Code:
    [ ] OpenRouterRunner class exists and implements AiRunner interface
    [ ] ai/index.ts exports OpenRouterRunner instance as the default runner (no claudeCliRunner export)
    [ ] @anthropic-ai/claude-agent-sdk removed from package.json dependencies
    [ ] storyGroups.agentOverrides shape documented to include preferred + fallback model per stage
  Behavior:
    [ ] When the preferred model returns a 429 / 5xx / 529, the runner retries once on the configured fallback model before giving up
    [ ] Each model call (preferred and fallback) writes a row in model_calls with story_id, stage, model id, tokens_in, tokens_out, usd, latency_ms, success, attempt, fallback_used
    [ ] Story-detail page shows sum(usd) for the story and a per-stage breakdown joined on stage
  Integration:
    [ ] All thirteen call sites that today call claudeCliRunner.runText/runStructured call the new runner unchanged (interface preserved)
    [ ] Per-stage model + fallback resolved from storyGroups.agentOverrides at orchestrator entry, defaulted into PipelineModels
  Observability:
    [ ] Each runner call logs model id, stage, tokens, usd, attempt at info level (matches current [ai] log format)
    [ ] Fallback activations log a warn line including from-model, to-model, reason
  Tests:
    [ ] packages/core/src/openrouter/openrouter.runner.test.ts asserts: runText happy path, runStructured happy path, fallback on 429
    [ ] packages/core/src/cost/cost-recorder.test.ts asserts a model_calls row is written per call

### SCENARIO 2: User overrides a stage's model on the new-story form
Type: business
Actor: parent

The parent picks the writer dropdown and switches from the universe default to a specific free-tier model. The pipeline uses that model for the writer stage; all other stages keep their universe defaults. The story's `run_snapshots` row records the actually-used writer model.

Acceptance:
  Code:
    [ ] New-story form renders six per-stage dropdowns + six fallback dropdowns populated from /api/models
    [ ] /api/models endpoint returns rows from model_catalog with id, name, input_usd_per_million, output_usd_per_million, is_free, supports_json_schema
  Behavior:
    [ ] Per-story override sent to the API as part of the create-story payload overrides the universe default for that stage only
    [ ] run_snapshots.<stage>Model records the model id actually used (override, not the universe default)
  Integration:
    [ ] Picker filters: free-only toggle, sort by input_usd_per_million ascending
    [ ] Model dropdown shows price label and free badge from model_catalog
  Observability:
    [ ] Not applicable
  Tests:
    [ ] derivePerStageModels deriver test: universe defaults + per-story overrides → resolved model map
    [ ] story-list endpoint integration test: created story with override has the override model in run_snapshots

### SCENARIO 3: User swaps a model mid-pipeline with a reason
Type: business
Actor: parent

The plotter just produced a plan. The parent thinks the prose feels lazy. They click "swap plotter model and rerun stage", a modal appears asking "Why?" with quick-pick chips and a free-text input. They pick `boring prose` and add a one-line note. Submit. The plotter stage reruns with the new model. The swap is logged with from-model, to-model, stage, reason chip, free-text, story_id, timestamp.

Acceptance:
  Code:
    [ ] model_swap_events table exists with story_id, stage, from_model, to_model, reason_chip, reason_text, created_at
    [ ] POST /api/stories/:id/swap-model endpoint exists and accepts stage, to_model, reason_chip, reason_text
    [ ] Swap modal component exists in web with chip list and text input
  Behavior:
    [ ] Swap modal blocks submission until either reason_chip or reason_text is non-empty
    [ ] After swap, the named stage reruns with the new model; downstream stages do not auto-rerun
    [ ] run_snapshots updates the model id for the rerun stage to the new model
  Integration:
    [ ] Frontend "swap and rerun" button visible only on stages that have already produced an output
    [ ] Swap event row inserted in same transaction as the stage rerun trigger
  Observability:
    [ ] Each swap logs at info level: story_id, stage, from_model, to_model, reason_chip
  Tests:
    [ ] swap endpoint integration test: rejects payload missing both reason_chip and reason_text
    [ ] swap endpoint integration test: writes model_swap_events row and triggers stage rerun

### SCENARIO 4: User views the admin dashboard
Type: business
Actor: parent

The parent opens `/admin`. They see a spend-over-time chart for the current month, a sortable stories table (title, date, models per stage, total tokens, total USD, parent rating, child rating, joy-per-dollar), a model leaderboard (joy-per-dollar, plan-iterations per model, swap-rate per model, tokens-per-char per model, free-tier completion rate), and an "awaiting feedback" inbox listing stories without value-for-money feedback yet.

Acceptance:
  Code:
    [ ] /admin route added in packages/web with the four sections above
    [ ] /api/admin/spend-over-time endpoint returns daily aggregates joined on model_calls
    [ ] /api/admin/model-leaderboard endpoint returns per-model aggregates
    [ ] /api/admin/awaiting-feedback endpoint returns stories with status in ('ready','read') and no value_for_money_feedback row
  Behavior:
    [ ] Joy-per-dollar = (parentReviews.rating + childReactions.enjoyed) / sum(model_calls.usd) per story, then averaged per model
    [ ] Plan-iterations per model = avg(stories.planIterations) where any plotter call used that model
    [ ] Swap-rate per model = count(model_swap_events where from_model=X) / count(stories where any stage ran X)
    [ ] Tokens-per-char per model = sum(tokens_out)/sum(length(stage_output_text)) where stage used that model
    [ ] Free-tier completion rate = count(stories) where every model_call.usd = 0 / total stories
    [ ] Stories with no model_calls rows show "—" for cost columns (historic/pre-OpenRouter)
  Integration:
    [ ] Aggregations live as pure derivers in packages/core/src/cost/aggregations/ — endpoints are thin wrappers
  Observability:
    [ ] Not applicable — dashboard is read-only
  Tests:
    [ ] deriveJoyPerDollar.test.ts asserts the formula on synthetic input rows
    [ ] derivePlanIterationsPerModel.test.ts
    [ ] deriveSwapRatePerModel.test.ts
    [ ] deriveTokensPerChar.test.ts
    [ ] deriveFreeTierCompletionRate.test.ts

### SCENARIO 5: User asynchronously rates value-for-money from the inbox
Type: business
Actor: parent

Sometime after reading a story to Sasha and quickly tapping "read", the parent opens `/admin` and sees the story in the awaiting-feedback inbox. They click it, type or dictate one sentence on whether the cost was worth it, give a 1–5 rating, submit. The story disappears from the inbox.

Acceptance:
  Code:
    [ ] value_for_money_feedback table exists with story_id (unique), rating (1-5), note (text), created_at
    [ ] POST /api/stories/:id/value-for-money endpoint exists
    [ ] Inbox row component renders rating input + dictation-friendly textarea
  Behavior:
    [ ] Inbox query filters out stories that already have a value_for_money_feedback row
    [ ] Submission is non-blocking on the read flow — read action stays a single tap with no modal
  Integration:
    [ ] /api/stories/:id/value-for-money requires rating in [1,5]; note optional
  Observability:
    [ ] Not applicable
  Tests:
    [ ] inbox query test: returns only stories without value_for_money_feedback rows
    [ ] endpoint integration test: rejects rating outside 1–5

### SCENARIO 6: User views cost on a ready story's detail page
Type: business
Actor: parent

The parent opens a story that just reached `status='ready'`. The detail page shows total USD spent for that story (sum of model_calls), a per-stage breakdown (stage, model, input tokens, output tokens, USD), and a "rate value-for-money" link.

Acceptance:
  Code:
    [ ] Story-detail page renders a cost-summary block when model_calls rows exist for the story
  Behavior:
    [ ] Total USD = sum(model_calls.usd) where story_id matches
    [ ] Per-stage rows ordered by created_at; if a stage was rerun (swap), both attempts are listed with the swap reason inline
    [ ] When no model_calls rows exist (legacy), the page renders no cost block (not "$0")
  Integration:
    [ ] Story-detail data fetch joins model_calls and model_swap_events
  Observability:
    [ ] Not applicable
  Tests:
    [ ] story-detail derivation test: builds the per-stage row list including swap-reason annotations

## Technical/Architectural Scenarios

### SCENARIO 7: OpenRouter model catalog syncs nightly
Type: technical
Actor: scheduler

A scheduled job runs once per day, fetches `GET /api/v1/models` from OpenRouter, upserts every model into `model_catalog` (id is primary key), and soft-deletes any catalog row whose model id no longer appears upstream. The picker UI continues to show the synced rows; soft-deleted rows remain queryable for historic stories but are filtered out of the picker.

Acceptance:
  Code:
    [ ] model_catalog table exists with id (pk), name, input_usd_per_million, output_usd_per_million, context_length, supports_json_schema, is_free, deleted_at, last_synced_at
    [ ] syncOpenRouterCatalog function exists and is registered as a daily job
  Behavior:
    [ ] Upsert preserves manual annotations (e.g. is_recommended_for_prose) on existing rows
    [ ] Models not present in the upstream response get deleted_at set; existing deleted_at rows are cleared if the model reappears
    [ ] /api/models endpoint filters out rows where deleted_at is not null
    [ ] Story-detail page resolves model name from model_catalog regardless of deleted_at
  Integration:
    [ ] Job uses the same node-cron / queue mechanism already in packages/core/src/queue/
  Observability:
    [ ] Sync logs: total fetched, inserted, updated, soft-deleted
  Tests:
    [ ] syncOpenRouterCatalog.test.ts: with a mocked upstream response, asserts upsert + soft-delete behavior

### SCENARIO 8: Structured-output stage falls back to prompt-coaxed JSON when the model lacks json_schema
Type: technical
Actor: pipeline

A structured-output stage (e.g. psychologist) runs on a model whose `supports_json_schema` flag is false. The runner sends the request without `response_format`, the prompt instructs the model to emit JSON, the response text is run through the existing balanced-brace extractor + Zod validation, and the parsed value is returned. If parsing fails, the existing retry-with-backoff kicks in (max 3 attempts).

Acceptance:
  Code:
    [ ] OpenRouterRunner.runStructured sends response_format only when model_catalog.supports_json_schema is true for the requested model
    [ ] Existing parseJsonWithSchema + jsonCandidates helpers are reused (moved out of claude-cli.runner.ts into a shared module)
  Behavior:
    [ ] On a non-json_schema model, the system prompt is appended with a JSON-only instruction line
    [ ] Parse failures retry up to 3 attempts with the existing backoff schedule
    [ ] After 3 attempts, AiValidationError is thrown
  Integration:
    [ ] Existing AiExecutionError, AiValidationError exports preserved (call sites depend on them)
  Observability:
    [ ] Each parse failure logs at warn level with attempt number and parse error
  Tests:
    [ ] runStructured.test.ts: model with supports_json_schema=true uses native mode and succeeds first try
    [ ] runStructured.test.ts: model with supports_json_schema=false uses prompt-coaxed path and succeeds
    [ ] runStructured.test.ts: 3 invalid responses throw AiValidationError
