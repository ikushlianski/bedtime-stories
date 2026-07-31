---
type: scenarios
branch: interactive-story-chat
task: Add a GCP dev deployment environment (web-only), auto-deployed on merge to main; prod becomes manual-only
state: draft
updated: 2026-07-24
---
# Scenarios: Dev deploy environment

## Business Scenarios

None — purely infrastructural change. No end-user-facing behavior changes on either environment;
this only changes how and where the existing app gets deployed.

## Technical/Architectural Scenarios

SCENARIO T1: Pushing to `main` auto-deploys dev, not prod

A commit lands on `main` (e.g. this branch gets merged). The deploy pipeline runs automatically.

What to verify:
- [ ] The `push: branches: [main]` trigger runs test → infra → deploy against the **dev** Cloud Run
  service and dev Neon branch, not prod.
- [ ] No prod resource (Cloud Run service `bedtime-api`, prod Neon `main` branch) is touched by this
  automatic run.

SCENARIO T2: Prod only deploys via explicit manual dispatch, and only from `main`

Someone runs `gh workflow run deploy.yml --field environment=prod` from a non-main branch.

What to verify:
- [ ] The workflow rejects (or the `environment: prod` choice is unavailable/validated against) any
  ref other than `main` — a feature branch can never reach prod, even via manual dispatch.
- [ ] Dispatching with `environment=prod` from `main` still works exactly like today's existing path
  (test → infra prod stack → deploy `bedtime-api`).

SCENARIO T3: Manual dispatch to dev works from any branch

Someone runs `gh workflow run deploy.yml --field environment=dev --ref interactive-story-chat` before
merging, to test an in-progress feature live.

What to verify:
- [ ] The dev Cloud Run service picks up that branch's code, independent of what's on `main`.
- [ ] This is the mechanism used to test this very feature (interactive story chat) on dev before
  it merges.

SCENARIO T4: The dev environment serves the web app correctly despite `NODE_ENV` staying `production`

The dev Cloud Run service starts up and receives a request for `/`.

What to verify:
- [ ] The React SPA is served (server.ts's static-file/catch-all block, gated on
  `NODE_ENV === 'production'`, must still fire in dev — this is the landmine found during planning).
- [ ] Auth cookies still get the `Secure` flag (gated the same way) — dev is served over HTTPS via
  Cloud Run, so this must not silently regress.
- [ ] The `DEV_API_KEY` local auth-bypass header stays inert (also gated on `NODE_ENV !== 'production'`)
  — it must not become a live unauthenticated-access path just because this is "dev."

SCENARIO T5: Dev and prod are visible as separate environments in Sentry and Langfuse despite sharing
one project each

A request fails on dev; separately, a request fails on prod.

What to verify:
- [ ] Both errors land in the same Sentry project (per Sentry's own documented practice: projects
  separate apps/services, environments separate deploy stages), but tagged `environment=dev` and
  `environment=production` respectively, driven by a new `APP_ENV` var — not by `NODE_ENV`, which
  stays `production` in both places per T4.
- [ ] Langfuse traces from dev carry `environment: dev` metadata (native Langfuse SDK `environment`
  field), distinguishing them from prod traces in the same project.

SCENARIO T6: The dev environment has no Telegram bot running

The dev Cloud Run service starts up.

What to verify:
- [ ] `TELEGRAM_BOT_TOKEN` is not set for dev — `bot` resolves to `null` (existing code path,
  `packages/api/src/routes/telegram.ts`), so no webhook route is registered and no bot commands fire.
- [ ] No Telegram-related secrets (`TELEGRAM_ALLOWED_USER_ID`, `TELEGRAM_WEBHOOK_URL`) are set for dev.

SCENARIO T7: A broken dev deploy cannot affect prod

A bad image gets deployed to dev (health check fails, or the app crashes on boot).

What to verify:
- [ ] Prod's Cloud Run service, Neon `main` branch, and Cloud Tasks queue are untouched — dev has its
  own Cloud Run service (`bedtime-api-dev`), its own Neon branch (`dev`), and its own Cloud Tasks queue
  (`bedtime-pipeline-dev`).
- [ ] The dev deploy job's health check failure only fails that GitHub Actions run — it does not
  trigger any prod action.

SCENARIO T8: Story generation actually completes on dev (async pipeline dispatch works end-to-end)

A parent creates a story via the dev web UI (using the accumulate-then-generate flow from the
interactive-story-chat feature).

What to verify:
- [ ] The Cloud Tasks push queue (`bedtime-pipeline-dev`) successfully enqueues and the worker
  callback (`PIPELINE_WORKER_URL` pointing back at the dev URL) fires against the dev service, not
  prod's.
- [ ] The generated story is visible in the dev web UI, confirming the full loop (enqueue → worker →
  DB write → UI read) works against the dev Neon branch.
