---
type: plan-summary
branch: main
task: move-to-api-1-runner
state: confirmed
phases-skipped: []
updated: 2026-04-25
parent-plan: move-to-api
sequence: 1 of 3
follow-on: move-to-api-2-overrides-cost
---

# Plan Summary: OpenRouter Runner Cutover (Phase 1 of 3)

This is the foundation phase of the move-to-api migration. It replaces the Claude Agent SDK with an OpenRouter-backed runner, sets up cost recording as a side effect of every model call, syncs the model catalog, and replaces hardcoded model constants with per-universe lookups. **No user-visible UI changes** — the existing pipeline runs end-to-end through OpenRouter with universe defaults, and cost rows accumulate silently for Phase 2 to surface.

## What changes in business logic

The story-generation pipeline stops being tied to Claude. Every stage calls OpenRouter as a single LLM gateway. Anthropic models remain available — they're now reached through OpenRouter alongside dozens of others, including free-tier models.

The system gains per-stage **preferred model + fallback model** resolution. Each universe declares both in `agent_overrides`. When the preferred model returns a retryable error (429 / 5xx / 529), the runner switches to the fallback for that stage on a single retry. Hardcoded `claude-sonnet-4-6` constants scattered across six pipeline files are removed — every stage resolves its model from the universe.

Every model call writes a `model_calls` row (story_id, stage, model, tokens_in, tokens_out, usd, latency_ms, success, attempt, fallback_used). Cost is captured but not yet rendered to the user; that happens in Phase 2.

The model catalog syncs nightly from OpenRouter into `model_catalog` with soft-delete for vanished models.

## What changes in user experience

Nothing visible. The pipeline produces stories using the same flow as before. The only externally-observable change is that `OPENROUTER_API_KEY` replaces the Anthropic CLI auth path.

## What changes architecturally

`@anthropic-ai/claude-agent-sdk` is removed from `packages/core/package.json`. `ClaudeCliRunner` and its tests are deleted. A new `OpenRouterRunner` implementing the existing `AiRunner` interface replaces it; the singleton swap in `ai/index.ts` is the cutover point. All thirteen `runText`/`runStructured` call sites work unchanged because the interface is preserved.

A new `OpenRouterClient` owns HTTP + SSE + retry/backoff + usage extraction. The JSON-extraction helpers (`parseJsonWithSchema`, `jsonCandidates`, `extractBalancedObject`) move from `claude-cli.runner.ts` into a shared `openrouter/json-extract.ts` module verbatim — preserving the prompt-coaxed JSON path for models without `supports_json_schema`.

`CostRecorder` writes a `model_calls` row for every OpenRouter request, in the same flow as the call so cost and stage outcome stay consistent.

The catalog sync job uses the existing `packages/core/src/queue/` mechanism (or node-cron, picked at implementation time based on what's already wired).

## Decisions made autonomously

- New code: `packages/core/src/openrouter/` (client, runner, sync, json-extract) and `packages/core/src/cost/` (recorder).
- Two of the four migration tables land here: `model_catalog` and `model_calls`. The other two (`model_swap_events`, `value_for_money_feedback`) ship in Phase 3 with the features that use them.
- Two derivers land here: `derivePerStageModels` (universe + per-story → resolved map; per-story override path stays dormant until Phase 2 wires it) and `deriveStructuredRequestPayload` (json_schema gating). The eight aggregation derivers ship with Phase 3.
- Catalog sync runs daily; soft-delete preserves historic story lookups.
- Streaming stays enabled for prose; assumption: OpenRouter prices per-token regardless of `stream:true|false` (preflight to verify before coding).
- Critics remain wired — disabling them is a separate task.
