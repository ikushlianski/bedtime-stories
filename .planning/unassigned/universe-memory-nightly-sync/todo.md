---
type: todo
branch: universe-memory-nightly-sync
task: Turn universe memory into a persistent, nightly-synthesized store fed by all feedback
state: open
updated: 2026-07-18
---
# Todo: Universe memory nightly sync

## Decisions to make
Nothing to decide — see spec.md "Decisions made autonomously" for every fork resolved during planning.

## To review / clarify
Nothing to review.

## Manual steps
- Generate and set the new secret before the infra deploy can succeed:
  `gh secret set PROD_UNIVERSE_MEMORY_SYNC_SECRET -R ikushlianski/bedtime-stories --body "$(openssl rand -hex 32)"`
  (same treatment as `PROD_CATALOG_SYNC_SECRET` — can be done non-interactively via `gh` CLI, no human required, but flagged here since it's a one-time credential rather than a code change.)
- `pulumi up` in `infra/` (via the deploy pipeline, or manually per project CLAUDE.md if run out of band) to actually create the Cloud Scheduler job and register the secret — code alone does not create the scheduled job.
- `npm run db:migrate` to apply the new `styleGuideSyncedAt` column — must run before the new sync code is exercised against production data (a missing column would fail every write, not just the new path).

## Post-deploy checks
- After the first scheduled run (or a manual `curl` against `/api/internal/universe-memory-sync` with the correct secret), confirm at least one universe with pending feedback got a non-null `styleGuideSyncedAt` and updated `styleGuideWorks`/etc. via a Neon query.
- Confirm `gh run list --workflow=deploy.yml` / Cloud Scheduler job history shows the new `universe-memory-sync` job executing on schedule, not just created.
