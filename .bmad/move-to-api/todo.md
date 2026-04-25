---
type: todo
branch: main
task: move-to-api
state: open
updated: 2026-04-25
---

# Human Todo: Move to OpenRouter

## Before implementation
- [ ] Create an OpenRouter account at openrouter.ai and generate an API key — needed because the new runner authenticates with `OPENROUTER_API_KEY`
- [ ] Add `OPENROUTER_API_KEY=<key>` to local `.env` and to whichever deployed environment runs the API package — needed because every LLM call requires it
- [ ] Top up an initial credit balance in OpenRouter (e.g. $5) — needed because most non-free models require pre-paid credits
- [ ] Decide a default fallback model per stage and record it in each universe's `agent_overrides` (or accept the seeded default the migration writes) — needed because the failure-handling flow depends on the fallback being configured

## After implementation
- [ ] Manually run a story end-to-end and confirm cost shows on the ready story page — sanity check that `total_cost` is being read off the response correctly
- [ ] Open `/admin` and confirm the awaiting-feedback inbox lists the new story
- [ ] Optionally open a follow-up task to disable the plot-critic and writer-critic loops, since you mentioned they shouldn't be running anymore — that work is intentionally NOT bundled into this provider migration
