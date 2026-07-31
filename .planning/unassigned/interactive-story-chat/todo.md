---
type: todo
branch: interactive-story-chat
task: Interactive story chat — accumulate-then-generate creation flow, plus diff view on patch proposals
state: open
updated: 2026-07-24
---
# Todo: Interactive story chat

## Decisions to make
Nothing to decide — all forks resolved autonomously, see spec.md "Decisions made autonomously".

## To review / clarify
Nothing to review — planned and self-confirmed without a human reviewer present (autonomous overnight
run). Flag on next human touchpoint: the accumulate-then-finalize UX (button + `/go`) has not been
seen by a real user yet — worth a quick manual Telegram smoke test when convenient.

## Manual steps
No manual steps required. Migration runs via `npm run db:migrate` against the disposable Neon dev
branch already configured in this worktree's `.env` — no secrets or env vars to add.

## Post-deploy checks
No post-deploy checks needed — this plan does not get deployed as part of this task (worktree-only,
not merged to main).
