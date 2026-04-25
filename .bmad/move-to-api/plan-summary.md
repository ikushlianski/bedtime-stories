---
type: plan-summary
branch: main
task: move-to-api
state: superseded
phases-skipped: []
updated: 2026-04-25
superseded-by:
  - move-to-api-1-runner
  - move-to-api-2-overrides-cost
  - move-to-api-3-admin-feedback
---

# Plan Summary: Move from Claude Agent SDK to OpenRouter

## What changes in business logic

The story-generation pipeline stops being tied to Claude. Every stage (plotter, plot-critic, writer, writer-critic, psychologist, plotter-questions, improver, title-generator, story-analyzer, universe-fact-extractor, feedback-synthesizer, style-guide-updater, universe-context-updater) calls OpenRouter as a single LLM gateway. Anthropic models remain available — they're now reached through OpenRouter alongside dozens of others, including free-tier models that should be exercised first when quality is acceptable.

The system gains a first-class concept of **per-stage model choice + per-stage fallback**. Each universe (story group) declares its preferred model per stage and a fallback model per stage in `agent_overrides`. Each story can override either of those at creation time. Mid-pipeline, the user can swap any stage's model — and is required to record a short reason every time they do, because that swap is one of the strongest signals about model quality.

Every model call records actual cost (USD) and token usage. Cost is shown on the story-detail page once the story is `ready`. Cost is also aggregated into a new `/admin` dashboard that shows: spend over time, most expensive story, cheapest-but-loved story, "joy per dollar" leaderboard by model combo, plan-iterations per model, mid-pipeline swap-rate per model with reason logs, tokens-per-output-character, free-tier completion rate, and a "stories awaiting feedback" inbox where the user can asynchronously rate value-for-money once Sasha is asleep — without blocking the read flow.

The model catalog is synced nightly from OpenRouter. Models that vanish from the upstream catalog are kept (soft-deleted) so historical stories still resolve their model name + cost.

## What changes in user experience

**Story creation** — the new-story form gains a per-stage section showing six (or more) model dropdowns, each with the universe's default pre-selected, a fallback dropdown next to it, a price tag (input/output $/M tokens), a "free" badge where applicable, and a sort/filter for "cheapest", "best for prose", "supports JSON". The user can leave defaults alone for the cheapest path, or experiment.

**During generation** — when a stage is running, the user can hit "swap model and rerun this stage". A modal asks "Why?" with quick-pick chips (`too verbose`, `broke format`, `boring prose`, `too slow`, `failed`) plus a free-text/voice note. Submission triggers a rerun of that stage with the new model. The swap event (from-model, to-model, reason, stage, story) is logged.

**Story detail page** — once `status='ready'`, the page shows total USD spent, breakdown per stage (model + tokens + USD), and a link to "rate value-for-money" that drops it into the inbox.

**Admin dashboard** (`/admin`, new) — single page with sections: Spend over time (line chart), Stories table (sortable by cost, rating, joy-per-dollar), Model leaderboard (joy-per-dollar, plan-iterations, swap-rate, tokens-per-char), Awaiting-feedback inbox, Mid-pipeline swap log.

**Reading flow stays untouched** — marking `read` is one tap; no feedback modal interrupts.

## What changes architecturally

`@anthropic-ai/claude-agent-sdk` is removed. A new `OpenRouterRunner` implementing the existing `AiRunner` interface replaces `ClaudeCliRunner`. All current call sites (`runText`, `runStructured`) work unchanged because the interface is preserved. The runner internally handles SSE streaming for `runText` (writer/plotter prose) and `response_format: json_schema` with prompt-coaxed fallback for `runStructured`. Skills (`.claude/skills/*/SKILL.md`) continue to be loaded from disk and concatenated into the system message.

A new persistence layer captures cost: `model_calls` table records every OpenRouter request with story_id, stage, model, tokens (in/out), USD, latency, success/failure, and attempt number. A `model_catalog` table holds the synced OpenRouter listing with our local annotations and soft-delete. A `model_swap_events` table records mid-pipeline swap reasons. A `value_for_money_feedback` table stores the asynchronous rating. The existing `run_snapshots` table is unchanged — it remains the per-stage model name snapshot; cost rolls up via `model_calls` joined on story_id.

A new server-side `OpenRouterClient` owns HTTP, SSE parsing, retry/backoff, and usage-extraction. A new `CostRecorder` writes a `model_calls` row inside the same DB transaction that completes a stage so cost and stage outcome stay consistent.

## Decisions made autonomously

- Folder structure: new code goes into `packages/core/src/openrouter/` for the client and `packages/core/src/cost/` for recording + aggregation derivers, following the existing entity-first convention.
- The runner interface is preserved so call sites in `pipeline/stages/*` and `pipeline/*-summarizer.ts` need no changes other than the singleton import in `ai/index.ts`.
- Hardcoded `claude-sonnet-4-6` constants in `feedback-synthesizer.ts`, `universe-context-updater.ts`, `style-guide-updater.ts`, `universe-fact-extractor.ts`, `story-analyzer.ts`, `improver.ts` get replaced by lookups against the universe's `agent_overrides` for each stage's model + fallback.
- Catalog sync runs as a Postgres `cron`-equivalent through the existing `packages/core/src/queue/` mechanism (or a simple node-cron) — chosen at implementation time based on what's already wired.
- The "stories awaiting feedback" inbox uses an existing-table query (stories where status in ('read','ready') and no row in `value_for_money_feedback`) — no new flag column on `stories`.
- Streaming is enabled by default for prose stages because OpenRouter's documented pricing is per-token, not per-request — flagged as assumption to verify in preflight.
- Critics (plot-critic, writer-critic) remain wired in the orchestrator code despite the user noting they "shouldn't even be running" — disabling them is a separate task and is not bundled with this provider migration.
