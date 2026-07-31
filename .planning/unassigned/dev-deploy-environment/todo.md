---
type: todo
branch: interactive-story-chat
task: Add a GCP dev deployment environment (web-only), auto-deployed on merge to main; prod becomes manual-only
state: open
updated: 2026-07-24
---
# Todo: Dev deploy environment

## Decisions to make
Nothing to decide — all forks resolved during planning, see spec.md "Decisions made autonomously" and
architecture.md.

## To review / clarify
Nothing to review.

## Manual steps

**Things only you can do** (external accounts I don't have access to):
- Create a new OpenRouter API key scoped/labeled for dev, and give it to me.
- Create a new Google OAuth 2.0 Client (Client ID + Secret) for dev, with redirect URI
  `https://dev.bedtime-agent.ilya.online/api/auth/google/callback`, and give me the client ID/secret.
- Give me the *existing* prod values for `SENTRY_DSN`, `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`,
  `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY` — these are reused as-is (same Sentry/Langfuse project),
  and GitHub never exposes an existing secret's value back to me once set, so I can't retrieve them
  myself.

**Things I'll do myself during implementation** (confirmed CLI access: `gcloud` authenticated as
`kushliansky@gmail.com`, `aws` authenticated, `pulumi` installed, `gh` authenticated):
- Create the persistent Neon `dev` branch (via Neon MCP).
- Restructure `infra/index.ts`, add `Pulumi.dev.yaml`, run `pulumi stack init dev` + first
  `pulumi up --stack dev`.
- Create the Route53 CNAME for `dev.bedtime-agent.ilya.online` in the `ilya.online` hosted zone.
- Generate fresh values for `JWT_SECRET`, `PIPELINE_WORKER_SECRET`, `CATALOG_SYNC_SECRET`,
  `UNIVERSE_MEMORY_SYNC_SECRET`, `BACKFILL_SECRET` (dev-specific, no relation to prod's values needed).
- Create the GitHub `dev` environment and set all its variables/secrets via `gh`.
- Run `npm run db:migrate` against the new dev branch as part of the first dev deploy.
- Rewrite `.github/workflows/deploy.yml`, `docs/ci-cd/README.md`, `docs/ci-cd/gcp-setup.md`.

## Post-deploy checks
- After the first dev deploy: confirm `dev.bedtime-agent.ilya.online` resolves and serves the SPA
  (not a 404 — the NODE_ENV landmine from architecture.md).
- Confirm a story can be created end-to-end on dev (SCENARIO T8) — this is the actual reason this
  environment exists, to test the interactive-story-chat feature live before merging.
- Confirm a dev-triggered error shows up in Sentry tagged `environment=dev`, not mixed into prod's
  default view.
