---
type: preflight
branch: main
task: move-to-api
state: confirmed
updated: 2026-04-25
---

# Preflight: Move from Claude Agent SDK to OpenRouter

## Business Logic

- Per-stage model + per-stage fallback chosen at universe level, optionally overridden per story.
- Mid-pipeline swap is a first-class user action; reason capture is required and feeds quality attribution.
- Cost is recorded at the model-call level (every OpenRouter request) and rolled up per-story and per-model.
- Value-for-money rating is asynchronous (inbox), never blocks the read flow.

## External API Contracts

**OpenRouter `POST /api/v1/chat/completions`** — OpenAI-compatible Chat Completions API.

Request shape (confirmed against project's existing usage of OpenAI-style payloads; specific fields needed):
```
{
  "model": "anthropic/claude-3.5-sonnet",
  "messages": [ { "role": "system", "content": "..." }, { "role": "user", "content": "..." } ],
  "stream": true | false,
  "response_format": { "type": "json_schema", "json_schema": { "name": "...", "schema": {...} } } // only when supports_json_schema
}
```

Response shape (non-streaming): standard Chat Completions object with an extra `usage` field that **OpenRouter populates with `total_cost`** (USD) plus `prompt_tokens` and `completion_tokens`.

Response shape (streaming, SSE): same chunked format as OpenAI. Final SSE chunk carries the `usage` object including `total_cost`.

**OpenRouter `GET /api/v1/models`** — returns array of available models with `id`, `name`, `pricing.prompt`, `pricing.completion`, `context_length`, `supported_parameters` (used to derive `supports_json_schema`).

**Auth**: `Authorization: Bearer $OPENROUTER_API_KEY` header on every request. Optional `HTTP-Referer` and `X-Title` headers improve spend attribution in OpenRouter's dashboard — set them to a stable identifier for this app.

## Assumptions & Risks

- **Streaming has no surcharge.** Assumption: OpenRouter prices per token regardless of `stream:true|false`. Risk if wrong: streaming becomes a cost driver and we'd want to disable it for prose. **To verify before implementation**: read OpenRouter pricing docs (specifically the FAQ or chat-completions section) and confirm.
- **Final SSE chunk carries usage including total_cost.** Assumption: usage is present in the final chunk when `stream:true`. Risk if wrong: we cannot record cost from streamed responses without an extra `GET /generation/:id` call, adding one HTTP round-trip per stage. **To verify**: confirm against OpenRouter docs or a smoke-test request.
- **Model catalog is small enough to sync in full daily.** Risk: if it grows to thousands of models, picker UI needs server-side filtering. Acceptable for v1.
- **`response_format: json_schema` with strict mode is supported by enough models.** Risk: too few models qualify and the prompt-coaxed fallback becomes the default path. Mitigation: fallback path is required either way, so this only affects model-picker UX (which models we mark green for structured stages).
- **Existing `AiRunner` interface is sufficient.** Reading the code confirms `runText` and `runStructured` are the only two methods used at all 13 call sites. Risk: low.
- **Single-user app.** No auth/multi-tenancy needed for `/admin` routes; same trust boundary as existing pages.

## Gaps

- The exact catalog-sync mechanism (`packages/core/src/queue/` vs node-cron vs Postgres `pg_cron`) is left to implementation discretion — pick whichever already runs in this app.
- The "joy-per-dollar" formula uses `(parentReviews.rating + childReactions.enjoyed) / total_usd`. Edge case: stories with no rating yet are excluded from leaderboards, not treated as 0.
- Pre-OpenRouter stories show no cost. The dashboard must guard against div-by-zero in joy-per-dollar when `total_usd = 0` (free-tier-only stories): treat as `null` (excluded from leaderboard), not infinity.

## Conflicts

- The user said "the critic … shouldn't be even running, honestly, for now." But `orchestrator.ts:127–168` still wires `runPlotCritic` and the critic loop, and stages `plot-critic.ts` and `writer-critic.ts` exist. **Resolved as: out of scope for this task.** Disabling critics is a separate, focused change. This task preserves current orchestrator wiring; the new runner serves the critic stages identically to all others. A follow-up task should be opened to remove critics if the user still wants that.
- The memory file `project-architecture.md` is 26 days old and lists six agents with hardcoded model mappings (e.g., "Plotter → Sonnet"). Current code uses 13+ stages and per-universe overrides. **Resolved as: trust current code over the memory snapshot.**
- CLAUDE.md mandates Neon migrations via `npm run db:migrate` — this plan honors that for the four new tables.

## To verify (before implementation)

1. Read OpenRouter Chat Completions docs section on streaming + usage → confirm `total_cost` appears in the final SSE chunk and that streaming does not add cost.
2. Read OpenRouter Models endpoint docs → confirm field names used here (`pricing.prompt`, `pricing.completion`, `supported_parameters`) match the actual response.
3. Confirm `packages/core/src/queue/` already runs scheduled jobs, or pick node-cron at implementation time.
