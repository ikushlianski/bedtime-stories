---
type: discussion
branch: main
task: move-to-api
state: confirmed
updated: 2026-04-25
---

# Developer Q&A: Move from Claude Agent SDK to OpenRouter

**Q1:** How fully should OpenRouter replace the current Claude Agent SDK runner?
**A:** Full replacement. Remove `@anthropic-ai/claude-agent-sdk` entirely; all LLM calls go through OpenRouter HTTP.

**Q2:** What is the budget enforcement model?
**A:** Visibility-only for v1 — track tokens + USD per model, per stage, per story, per month. No hard caps.

**Q3:** How should models be selected at story-creation time, and what's the admin shape?
**A:** Per-stage picker with experimentation in mind. Log which model produced which piece of which story so the best combination becomes discoverable. Admin dashboard that shows expenses, output, parent feedback, cost — emphasizing cost-effectiveness.

**Q4:** How should model quality attribution work?
**A:** Per-stage model snapshot + parent rating join (use existing `run_snapshots` + new cost rows; no manual tagging needed in v1).

**Q5:** How should the OpenRouter model catalog reach the picker UI?
**A:** Sync nightly into a DB table, serve from API. Picker is fast, survives OpenRouter outages, and we can attach our own annotations (e.g. "good for prose").

**Q6:** When a chosen model fails mid-pipeline, what should happen?
**A:** Each model selection has a paired fallback. One global default fallback set in settings; per-story override available. Encourage frequent model experimentation between stories. Cost spent at story creation must be visible on the ready story page.

**Q7:** Where does the admin dashboard live and what does it show?
**A:** Separate `/admin` page. Sections: spend over time; most expensive story (with its models); cheapest-but-loved story (judged by parent feedback); easiest story to develop (low swap-rate); model swap reasons captured per swap (because if the user says "Kimmy is stupid" that should affect the model's score in this tool); per-model overall feedback section. Plus: the tool should actively ask for value-for-money feedback when the user spent money — short voice-friendly input.

**Q8:** Six extra stats — which land in v1?
**A:** Skip critic flag-rate (critics shouldn't even be running now in the user's mental model). Keep: plan-iterations per model, mid-pipeline swap-rate per model, tokens-per-output-character, joy-per-dollar leaderboard, free-tier completion rate.

**Q9:** When you swap a model mid-story, when should the app ask for a reason?
**A:** Required modal on every swap, with quick-pick chips and free text.

**Q10:** When does the app ask for value-for-money feedback?
**A:** After parent reads the story to child — but **not** as a blocking modal at "mark as read" time. Sasha demands the next story immediately; the parent can't be interrupted. Use an asynchronous "stories awaiting feedback" inbox on `/admin` that the parent visits when free.

**Q11:** Per-model overall feedback — captured how?
**A:** Auto-derived from story ratings for v1. The blocker for explicit per-story rating-on-read is the time-pressure described in Q10; revisit async UI later.

**Q12:** Streaming for writer/plotter prose — keep it?
**A:** Keep it if it doesn't increase cost. (Recorded in preflight as an assumption to verify against OpenRouter docs.)

**Q13:** Structured-output strategy for stages that need JSON?
**A:** Try `response_format: json_schema` first, fall back to prompt-coaxed JSON parse with the existing balanced-brace extractor + Zod validate.

**Q14:** API key handling?
**A:** Single `OPENROUTER_API_KEY` env var, server-side only.
