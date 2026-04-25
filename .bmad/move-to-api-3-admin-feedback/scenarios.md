---
type: scenarios
branch: main
task: move-to-api-3-admin-feedback
state: confirmed
updated: 2026-04-25
---

# Scenarios: Mid-Pipeline Swap + Admin Dashboard + VFM Inbox

### SCENARIO 3: User swaps a model mid-pipeline with a reason
Type: business
Actor: parent

The plotter just produced a plan. The parent thinks the prose feels lazy. They click "swap plotter model and rerun stage", a modal appears asking "Why?" with quick-pick chips and a free-text input. They pick `boring prose` and add a one-line note. Submit. The plotter stage reruns with the new model. The swap is logged.

Acceptance:
  Code:
    [ ] model_swap_events table exists with story_id, stage, from_model, to_model, reason_chip, reason_text, created_at, with check constraint that reason_chip or reason_text is non-empty
    [ ] POST /api/stories/:id/swap-model endpoint exists in packages/api/src/routes/stories-swap-model.ts
    [ ] swap-model-modal.tsx component exists in packages/web/src/components/
  Behavior:
    [ ] Swap modal blocks submission until either reason_chip or reason_text is non-empty
    [ ] After swap, the named stage reruns with the new model; downstream stages do not auto-rerun
    [ ] run_snapshots updates the model id for the rerun stage to the new model
    [ ] Endpoint validates reason_chip is one of the allowed values OR reason_text is non-empty; rejects 400 otherwise
  Integration:
    [ ] Frontend "swap and rerun" button visible only on stages that have already produced an output
    [ ] Swap event row + run_snapshots update committed in the same DB transaction; rerun job is dispatched after commit (eventual consistency on the trigger itself, recorded in decisions.md)
  Observability:
    [ ] Each swap logs at info level: story_id, stage, from_model, to_model, reason_chip
  Tests:
    [ ] swap endpoint integration test: rejects payload missing both reason_chip and reason_text
    [ ] swap endpoint integration test: writes model_swap_events row, updates run_snapshots, triggers stage rerun

### SCENARIO 4: User views the admin dashboard
Type: business
Actor: parent

The parent opens `/admin`. They see a spend-over-time chart for the current month, a sortable stories table (title, date, models per stage, total tokens, total USD, parent rating, child rating, joy-per-dollar), a model leaderboard (joy-per-dollar, plan-iterations per model, swap-rate per model, tokens-per-char per model, free-tier completion rate), and an awaiting-feedback inbox.

Acceptance:
  Code:
    [ ] /admin route registered in packages/web/src/app.tsx
    [ ] admin.tsx page composes four section components
    [ ] /api/admin/spend-over-time returns daily aggregates
    [ ] /api/admin/model-leaderboard returns per-model aggregates
    [ ] /api/admin/awaiting-feedback returns stories with status in ('ready','read') and no value_for_money_feedback row
    [ ] /api/admin/stories-table returns the joined stories rows
  Behavior:
    [ ] Joy-per-dollar = (parentReviews.rating + childReactions.enjoyed) / sum(model_calls.usd) per story, then averaged per model; null when total_usd = 0
    [ ] Plan-iterations per model = avg(stories.planIterations) where any plotter call used that model
    [ ] Swap-rate per model = count(model_swap_events where from_model=X) / count(stories where any stage ran X)
    [ ] Tokens-per-char per model = sum(tokens_out)/sum(length(stage_output_text)) where stage used that model
    [ ] Free-tier completion rate = count(stories where every model_call.usd = 0) / total stories
    [ ] Stories with no model_calls rows show "—" for cost columns; stories with no rating yet are excluded from leaderboards
  Integration:
    [ ] All endpoints are thin wrappers over derivers in packages/core/src/cost/aggregations/
  Observability:
    [ ] Not applicable — dashboard is read-only
  Tests:
    [ ] derive-joy-per-dollar.test.ts asserts the formula on synthetic input rows; null when total_usd = 0
    [ ] derive-plan-iterations-per-model.test.ts
    [ ] derive-swap-rate-per-model.test.ts
    [ ] derive-tokens-per-char.test.ts
    [ ] derive-free-tier-completion-rate.test.ts
    [ ] derive-spend-over-time.test.ts
    [ ] derive-stories-table.test.ts

### SCENARIO 5: User asynchronously rates value-for-money from the inbox
Type: business
Actor: parent

Sometime after reading a story to Sasha and quickly tapping "read", the parent opens `/admin` and sees the story in the awaiting-feedback inbox. They click it, type or dictate one sentence on whether the cost was worth it, give a 1–5 rating, submit. The story disappears from the inbox.

Acceptance:
  Code:
    [ ] value_for_money_feedback table exists with story_id (unique), rating (1-5 check), note (text), created_at
    [ ] POST /api/stories/:id/value-for-money endpoint exists
    [ ] admin-awaiting-feedback-inbox.tsx renders rating input + dictation-friendly textarea per row
  Behavior:
    [ ] Inbox query (deriveAwaitingFeedbackInbox) filters out stories that already have a value_for_money_feedback row
    [ ] Submission is non-blocking on the read flow — the read action stays a single tap with no modal
    [ ] Endpoint validates rating in [1,5]; rejects 400 otherwise; note optional
  Integration:
    [ ] story-reader.tsx exposes a "rate value-for-money" link that navigates to /admin inbox section anchored to the story
    [ ] Inbox query uses left-join + IS NULL on value_for_money_feedback (no flag column on stories)
  Observability:
    [ ] Not applicable
  Tests:
    [ ] derive-awaiting-feedback-inbox.test.ts: returns only stories without value_for_money_feedback rows, ordered by ready_at desc
    [ ] vfm endpoint integration test: rejects rating outside 1–5
    [ ] vfm endpoint integration test: accepts rating without note; persists row; story disappears from inbox query
