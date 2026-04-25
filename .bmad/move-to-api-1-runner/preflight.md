---
type: preflight
branch: main
task: move-to-api-1-runner
state: confirmed
updated: 2026-04-25
parent-preflight: ../move-to-api/preflight.md
---

# Preflight: OpenRouter Runner Cutover (Phase 1)

External API contracts (Chat Completions request/response, SSE shape, `/models` shape, auth headers) live in `../move-to-api/preflight.md`. Treat that document as canonical for OpenRouter wire details. Phase 1 only restates the assumptions that **must** be verified before any code is written for this phase.

## Assumptions in effect (Phase 1)

- **Streaming has no surcharge.** OpenRouter prices per token regardless of `stream:true|false`. **Verify before coding** by reading OpenRouter pricing docs (FAQ / chat-completions section). Risk if wrong: streaming becomes a cost driver and we'd want to disable it for prose.
- **Final SSE chunk carries `usage` including `total_cost`.** Without this, the cost recorder needs an extra `GET /generation/:id` per call. **Verify** against OpenRouter SSE docs or a smoke-test request before implementing the runner.
- **`/api/v1/models` returns `id`, `name`, `pricing.prompt`, `pricing.completion`, `context_length`, `supported_parameters`** with the same field names as documented. **Verify** with a single live request before writing `sync-catalog.ts`.
- **`AiRunner` interface is sufficient.** All thirteen call sites use only `runText` and `runStructured`. Re-confirmed by grepping the codebase before deletion of `claude-cli.runner.ts`.
- **Catalog scheduler exists.** `packages/core/src/queue/` already runs scheduled jobs, OR node-cron is acceptable. Pick whichever is already wired — do not introduce a third scheduling primitive.
- **`storyGroups.agentOverrides` is jsonb and absorbs `{ <stage>: { model, fallback } }`** with no schema migration. Verified by reading the schema in Phase 1's spec discovery step.
- **`OPENROUTER_API_KEY` is in the environment.** If not, request it from the user before step 6 (client implementation). The smoke test in step 13 cannot run without it.

## Out-of-scope assumptions (deferred to Phase 2 / Phase 3)

These are real assumptions but they don't gate any Phase 1 code:

- Per-story override picker UX (Phase 2).
- Mid-pipeline swap atomicity (Phase 3 — to be resolved as outbox / eventual consistency).
- Joy-per-dollar formula edge cases (Phase 3).

## To verify (before implementation)

1. OpenRouter Chat Completions docs section on streaming + usage → confirm `total_cost` appears in the final SSE chunk and that streaming does not add cost.
2. OpenRouter Models endpoint docs → confirm field names listed above match the actual response.
3. Confirm `packages/core/src/queue/` already runs scheduled jobs, or pick node-cron at implementation time.
4. Confirm `OPENROUTER_API_KEY` is present in `.env` (or equivalent) before the runner client is implemented.
