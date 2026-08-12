---
type: todo
branch: content-ux-fixes-aug12
task: Block-based story rewrite — let the parent rewrite one paragraph at a time via chat instead of regenerating the whole story
state: open
updated: 2026-08-12
---
# Todo: Block-based story rewrite

## Decisions to make
Nothing to decide — all forks resolved autonomously, see spec.md "Decisions made autonomously".

## To review / clarify
Nothing blocking. Flag on next human touchpoint:
- The duplicate-paragraph find/replace ambiguity (spec.md SCENARIO 5) is an accepted pre-existing
  limitation, not fixed here — worth deciding later whether it's worth solving with a
  block-index-aware patch endpoint if it ever bites in practice.
- The `conversations` endpoint (`packages/api/src/routes/pipeline-questions.ts`) folds the entire
  prior message history for `context='text'` into every prompt, regardless of which block the
  current message is scoped to. Block-by-block iteration is exactly the usage pattern that grows
  this history fastest (one block per exchange instead of one whole-story exchange), so token cost
  per edit rises across a long editing session, and there is some risk of a prior block's rewrite
  bleeding into the current one. The existing diff-before-apply UI means the parent sees this
  before it lands, so it degrades quality rather than corrupting silently — not fixed here since it
  would need a `selected_text` column on `plan_conversations` to scope history per-block, which is
  a real schema change against this task's simplicity mandate. Worth revisiting if block editing
  sessions turn out to run long in practice.

## Manual steps
No manual steps required. No migration, no new env vars, no schema change.

## Post-deploy checks
No post-deploy checks needed — this ships on the next normal deploy of `content-ux-fixes-aug12`
along with its sibling commits on this branch.
