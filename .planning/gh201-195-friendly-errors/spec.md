---
type: spec
branch: pipeline-friendly-errors
task: "Friendly error messages on story creation failure (GH #201) + fix infinite polling on unrecoverable error (GH #195)"
complexity: simple
state: confirmed
updated: 2026-07-29
---
# Spec: Friendly failure messages + polling-loop fix

### What to do

**GH #195 (confirmed bug, verified in code):** `questions-pipeline-section.tsx`'s `setInterval`-based poll only calls `clearInterval` on the success path. Its `catch` block did `setLoading(false)` and nothing else — the interval kept firing every 3s forever on any unrecoverable error, with no error ever shown (the UI stayed stuck showing "ИИ придумывает вопросы..." indefinitely since the render condition was `loading || questions.length === 0`, both of which stay satisfied on a silently-swallowed error).

**GH #201, split by surface, only the confirmed-bad ones addressed here** (the Telegram async-failure gap was already closed in the separate `pipeline-stuck-job-timeout` branch's `notifyStoryFailed` work — not duplicated here):
- The shared `formatApiError` (used by every API call in the app, `packages/web/src/lib/api.ts`) always prefixed a real backend message with `"API error {status}: "` and, when no structured message existed, showed the raw HTTP status/statusText (`"API error 500: Internal Server Error"`) — meaningless to a parent.
- `pipeline-status.tsx`'s failed-phase message told the user to "check API logs," which a parent has no access to or use for, when a retry button already sits right below it.

### Decisions made autonomously

1. **`formatApiError` drops the technical prefix and adds one generic friendly fallback**, rather than special-casing story creation specifically — it's a shared formatter used everywhere, so fixing it there fixes every call site, not just story creation. Reversible, single function.
2. **The generic fallback message doesn't vary by HTTP status** (no special 401/404/500 wording) — this app's routes that intentionally reject a request already return a structured, readable `.error` message (confirmed via existing test cases); the fallback path is specifically the true-crash case, where guessing more specific wording than "something went wrong, try again" would be inventing detail the app doesn't actually have.
3. **Raw status/body is still logged to the console** at the fetch-wrapper call site (`api.ts`), separate from the friendly message thrown for the UI — preserves developer diagnosability without putting it in front of the parent.
4. **The polling fix adds a manual retry button rather than auto-retrying** — an error that survives to this point is, by definition, not resolving itself; auto-retrying it would just recreate the original infinite-loop bug on a slower cadence. A manual retry re-triggers the same fetch effect via a small `retryKey` counter.

### Files modified

```
packages/web/src/
├── lib/
│   ├── format-api-error.ts       — drop technical prefix, single generic friendly fallback,
│   │                                 drop now-unused status/statusText params
│   ├── format-api-error.test.ts  — updated to match the new signature/behavior
│   └── api.ts                    — both call sites updated; console.error added for diagnostics
├── components/
│   ├── questions-pipeline-section.tsx       — catch block clears the interval and surfaces
│   │                                           a fetchError state instead of swallowing it;
│   │                                           error UI replaces the spinner with a retry button
│   └── questions-pipeline-section.test.tsx  — new: verifies polling stops and the retry UI
│                                                appears after an unrecoverable fetch error
└── pages/
    └── pipeline-status.tsx  — failed-phase message no longer references "API logs"
```

### Data model changes
None.

### Documentation changes
None — no architectural shift, a formatting/messaging fix plus a confirmed bug fix.

### Scope boundary
Out of scope: the Telegram async-failure notification gap from GH #201's original report — already closed by the `pipeline-stuck-job-timeout` branch's `notifyStoryFailed` addition; not duplicated here to avoid a merge conflict doing the same work twice. When these branches merge, no further action needed on that front.
