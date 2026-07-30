---
type: spec
branch: pipeline-stuck-job-timeout
task: "Stuck Story Job Timeout and Auto-Failure (GH #226)"
complexity: simple
state: confirmed
updated: 2026-07-29
---
# Spec: Stuck story job timeout and auto-failure

### What to do

**Root cause, verified in code:** `packages/core/src/openrouter/openrouter.client.ts` makes raw `fetch()` calls to OpenRouter with no timeout, no `AbortController`. A hung or non-responding provider request can wait indefinitely. This is why a story generation can get stuck with no resolution — not a missing "detect stuck jobs" sweep, but the actual network call never settling in the first place. Confirming this was the intended design and not an oversight: `openrouter.runner.ts`'s `isRetryable()` already special-cases error messages containing `'timeout'` as retryable — the retry path was built expecting timeouts to happen, but nothing ever produced one.

Two things production already has that reduce the blast radius, so this is a targeted fix, not a redesign:
- Cloud Tasks (`PIPELINE_QUEUE`, confirmed configured in `.github/workflows/deploy.yml`) dispatches pipeline runs as real queued HTTP tasks with a 900s `dispatchDeadline`, and the worker handler (`packages/api/src/routes/internal-worker.ts`) `await`s the full pipeline inside the request — so a crashed/restarted instance mid-run already gets retried by Cloud Tasks. A separate DB-persisted-status sweep would duplicate this, not add real coverage.
- The existing `catch` blocks in `pipeline-auto-trigger.ts` / `pipeline-text-trigger.ts` already set `plan_failed` / `text_failed` — once something actually throws, the failure path is already correct. It just never gets triggered by a hang, only by an outright error.

What's genuinely missing, and what this spec fixes:
1. A bounded timeout on every OpenRouter HTTP call, so a hang always resolves to a real, retryable error within a sane window instead of waiting forever.
2. A Telegram notification when the auto pipeline's plan or text phase ultimately fails (all retries exhausted) — today nothing tells the parent a story failed; the only signal is a story that silently never finishes and an ephemeral in-memory status that vanishes on process restart and isn't visible unless they happen to have the live status page open at that exact moment.

### Decisions made autonomously

1. **Per-request timeout of 180 seconds (3 minutes).** The Writer stage generates full story text (`minOutputTokens: 4000` per `recommend-model.ts`) and is the slowest call — 180s is generous for that while still bounded well inside Cloud Tasks' 900s overall dispatch deadline, leaving room for the existing retry/fallback loop to use its normal backoff after a timeout. Reversible — a single constant.
2. **Timeout applies to all three `OpenRouterClient` methods** (`listModels`, `chatNonStream`, `chatStream`), not just the structured-output path, since `listModels` (catalog sync) and streaming (interactive writer/rewrite flows) can hang exactly the same way.
3. **On timeout, throw an `Error` whose message contains `'timeout'`**, so the existing `isRetryable()` classification picks it up with zero changes to the runner's retry logic — the retry path already expects this shape of error.
4. **Failure notification only for `mode === 'auto'`**, mirroring the existing success-notification behavior (`notifyStoryReady` is also only called `if (isAuto)`). Manual/redo flows are already synchronous from the parent's perspective (they're watching the live status page when they triggered it), so a push notification adds no value there — only auto-pipeline runs (which can happen while the parent isn't watching, e.g. triggered from Telegram and then the phone is put away) need a proactive nudge.
5. **No new DB column, no new scheduled sweep.** As reasoned above, Cloud Tasks' own retry-on-failure already covers the crash/restart case; adding a redundant server-side sweep against `stories` timestamps would duplicate that mechanism for no added reliability, at the cost of real complexity (cross-instance in-memory-status visibility, false-positive risk on scale-to-zero cold starts). Out of scope — flagged below, not silently dropped.

### Files to modify

```
packages/core/src/openrouter/
├── openrouter.client.ts   — AbortController + setTimeout (180s, named constant) around all three
│                             fetch calls; on abort, throw an Error with 'timeout' in the message;
│                             clear the timeout in a finally so it never leaks
packages/api/src/routes/
├── pipeline-notifications.ts  — add notifyStoryFailed(storyId, phase: 'plan' | 'text'), same
│                                 registerStoryReadyCallback-style pattern as notifyStoryReady
├── pipeline-auto-trigger.ts   — call notifyStoryFailed in the existing plan-phase catch block
├── pipeline-text-trigger.ts   — call notifyStoryFailed in the existing text-phase catch block,
│                                 only when mode === 'auto'
└── telegram.ts                — register the failure callback, distinct message per phase
```

### Files to create
No new files.

### Data model changes
None.

### Documentation changes
No documentation changes required — no architectural shift (no new service, no new infra, no schema change). A bug fix to an existing HTTP client plus a notification wired the same way an existing one already is.

### Scope boundary
Out of scope: a server-side scheduled sweep for stuck jobs (reasoned above as redundant with Cloud Tasks' existing retry); persisting pipeline status to Postgres (the in-memory map's only real weakness — surviving a process restart — is already covered by Cloud Tasks retry, so persisting it doesn't buy additional reliability here); changing Cloud Tasks' own retry count/backoff config (infrastructure already reasonable, not touched by this app-level fix).

### Implementation order
1. `openrouter.client.ts` — add the timeout to all three fetch call sites.
2. `pipeline-notifications.ts` — add `notifyStoryFailed`.
3. `pipeline-auto-trigger.ts` / `pipeline-text-trigger.ts` — call it from the existing catch blocks.
4. `telegram.ts` — register and message the failure callback.
5. Typecheck, test, verify.
