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
Nothing blocking. Flag on next human touchpoint: the duplicate-paragraph find/replace ambiguity
(spec.md SCENARIO 5) is an accepted pre-existing limitation, not fixed here — worth deciding later
whether it's worth solving with a block-index-aware patch endpoint if it ever bites in practice.

## Manual steps
No manual steps required. No migration, no new env vars, no schema change.

## Post-deploy checks
No post-deploy checks needed — this ships on the next normal deploy of `content-ux-fixes-aug12`
along with its sibling commits on this branch.
