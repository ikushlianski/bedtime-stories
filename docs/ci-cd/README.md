# CI/CD Overview

## Topology

```
GitHub push to main  (or manual workflow_dispatch)
  └── GitHub Actions (.github/workflows/deploy.yml)
        ├── test     — npm run typecheck + npm test (vitest)
        ├── infra    — pulumi up (needs: test)
        │              state stored in GCS bucket bedtime-pulumi-state
        │              auth via Workload Identity Federation (keyless, no SA JSON key)
        └── deploy   — docker build → push → gcloud run deploy (needs: infra)

User browser  →  https://bedtime-agent.ilya.online
  └── Cloud Run DomainMapping (us-central1, free managed cert)
        └── Cloud Run service `bedtime-api` (us-central1)
              ├── /api/*  → Express API handlers
              └── /*      → packages/web/dist (React SPA, bundled in Docker image)
```

The API and frontend are served from the same Cloud Run URL. This keeps auth cookies on the same origin (HTTP-only, `sameSite: strict`) and eliminates CORS entirely.

There is **no Global External HTTPS Load Balancer**. The custom domain is wired via Cloud Run's DomainMapping (GA in `us-central1`), which provides a free Google-managed certificate. Route 53 (`ilya.online` hosted zone `Z2DCC0LAF4MJM8`) holds the CNAME → `ghs.googlehosted.com` that DomainMapping requires.

---

## What Pulumi manages (infra/index.ts)

Every GCP resource is declared in `infra/index.ts` and managed by Pulumi. Do not create or modify these manually:

- GCP project `bedtime-prod`
- Service API enables (Cloud Run, Artifact Registry, Storage, IAM, Cloud Resource Manager, STS, IAM Credentials)
- Artifact Registry repo `bedtime-api` (Docker, `us-central1`)
- GCS bucket `bedtime-prod-storage` (versioned, `europe-west3` — intentionally left there, cross-region reads are fine for low volume)
- Service accounts:
  - `bedtime-api@bedtime-prod.iam.gserviceaccount.com` — Cloud Run runtime identity
  - `github-ci@bedtime-prod.iam.gserviceaccount.com` — GitHub Actions CI identity (also a verified owner of `ilya.online` in Google Site Verification, required for DomainMapping)
- IAM bindings for CI SA: `run.admin`, `artifactregistry.writer`, `storage.admin`, `iam.serviceAccountUser`
- Cloud Run service `bedtime-api` (`us-central1`, public, 3 max instances, 512Mi/1CPU)
- Cloud Run public invoker (`allUsers` → `roles/run.invoker`)
- Cloud Run DomainMapping `bedtime-agent.ilya.online` → `bedtime-api` (`us-central1`)

Pulumi state is stored in GCS: `gs://bedtime-pulumi-state` (not Pulumi Cloud). The passphrase is in GitHub secret `PROD_PULUMI_CONFIG_PASSPHRASE`.

---

## What was bootstrapped manually (one-time, already done)

These resources are **not** managed by Pulumi and must not be deleted:

1. **GCS bucket `bedtime-pulumi-state`** — Pulumi state backend. Created before the first `pulumi up`.
   ```bash
   gsutil mb -p bedtime-prod -l europe-west3 gs://bedtime-pulumi-state
   ```

2. **`serviceusage.googleapis.com` enabled** — Required for Pulumi to list/enable other APIs.
   ```bash
   gcloud services enable serviceusage.googleapis.com --project=bedtime-prod
   ```

3. **Workload Identity Federation pool + provider** — Keyless auth for GitHub Actions → GCP.
   - Pool: `github` (`projects/28324530789/locations/global/workloadIdentityPools/github`)
   - Provider: `github-actions`
   - Binding: allows `ikushlianski/bedtime-stories` repo to impersonate the `github-ci` SA
   - These are hardcoded in `deploy.yml` and do not change unless the repo is renamed.

4. **`github-ci` SA granted `roles/owner`** — Required for Pulumi to create/modify IAM and APIs.
   ```bash
   gcloud projects add-iam-policy-binding bedtime-prod \
     --member="serviceAccount:github-ci@bedtime-prod.iam.gserviceaccount.com" \
     --role="roles/owner"
   ```

---

## GitHub Actions configuration

The workflow uses both **variables** (non-secret config) and **secrets** (sensitive values). All are scoped to the `prod` environment.

### Variables (Settings → Environments → prod → Variables)

| Variable | Value |
|----------|-------|
| `PROD_REGION` | `us-central1` |
| `PROD_PROJECT_ID` | `bedtime-prod` |
| `PROD_REGISTRY` | `us-central1-docker.pkg.dev/bedtime-prod/bedtime-api` |
| `PROD_SENTRY_ORG` | `ilya-org-jo` |
| `PROD_SENTRY_PROJECT` | `bedtime-agent` |
| `PROD_LANGFUSE_BASE_URL` | `https://cloud.langfuse.com` |
| `PROD_APP_URL` | `https://bedtime-agent.ilya.online` — set after DNS is wired up; until then the health check falls back to the raw Cloud Run URL |
### Secrets (Settings → Environments → prod → Secrets)

| Secret | Description |
|--------|-------------|
| `PROD_PULUMI_CONFIG_PASSPHRASE` | Pulumi stack encryption passphrase |
| `PROD_DATABASE_URL` | Neon PostgreSQL connection string |
| `PROD_JWT_SECRET` | Min 32-char secret for JWT signing |
| `PROD_OPENROUTER_API_KEY` | OpenRouter API key |
| `PROD_SENTRY_DSN` | Sentry DSN (server-side error tracking) |
| `PROD_VITE_SENTRY_DSN` | Sentry DSN (embedded in frontend build) |
| `PROD_SENTRY_AUTH_TOKEN` | Sentry auth token for source map upload |
| `PROD_LANGFUSE_SECRET_KEY` | Langfuse secret key |
| `PROD_LANGFUSE_PUBLIC_KEY` | Langfuse public key |
| `PROD_UNIVERSE_MEMORY_SYNC_SECRET` | Header secret for the nightly `universe-memory-sync` Cloud Scheduler job → `/api/internal/universe-memory-sync` |

---

## Deploying

### Authoritative facts (do not guess)

- Workflow file: `.github/workflows/deploy.yml`
- Trigger: push to `main`, or `workflow_dispatch`
- Inputs (workflow_dispatch only):
  - `environment` — choice, only valid value: `prod`
  - `pulumi_refresh` — boolean, default `false`. On push triggers refresh always runs anyway.
- GitHub remote: `ikushlianski/bedtime-stories`
- Default branch: `main`
- Production URL: `https://bedtime-agent.ilya.online`
- Fallback Cloud Run URL: discoverable via `gcloud run services describe bedtime-api --region us-central1 --project bedtime-prod --format='value(status.url)'`

### How to deploy (the only two paths)

**Path A — push to `main`.** This is the normal path. The pipeline (`test → infra → deploy`) runs automatically.

```bash
git push origin main
```

**Path B — manual dispatch from any branch.** Use this only when explicitly asked. Always deploy from the current branch — never substitute `main`.

```bash
CURRENT_BRANCH=$(git branch --show-current)
gh workflow run deploy.yml \
  --ref "$CURRENT_BRANCH" \
  --field environment=prod \
  --field pulumi_refresh=false \
  -R ikushlianski/bedtime-stories
```

Set `pulumi_refresh=true` only after a manual GCP change or state-corruption recovery.

### How to monitor a run

```bash
gh run list --workflow=deploy.yml --limit=5 -R ikushlianski/bedtime-stories
gh run watch <run-id> --exit-status -R ikushlianski/bedtime-stories
```

### What the `/commit-push-deploy` skill does

1. Reads `.github/workflows/deploy.yml` to derive the inputs above (do not hardcode).
2. Commits staged changes (imperative mood, no AI mentions, no `Co-Authored-By`).
3. `git push` (or `git push -u origin <current branch>` on first push).
4. `gh workflow run deploy.yml --ref <current branch> --field environment=prod --field pulumi_refresh=false`.
5. Reports the run URL.

Never deploy from `main` or any hardcoded branch in the manual-dispatch step — always pass `git branch --show-current`.

---

## Rollback

Re-deploy a previous image tag:

```bash
gcloud run deploy bedtime-api \
  --image us-central1-docker.pkg.dev/bedtime-prod/bedtime-api/api:<PREVIOUS_SHA> \
  --project bedtime-prod \
  --region us-central1
```

Find available image tags in Artifact Registry: https://console.cloud.google.com/artifacts/docker/bedtime-prod/us-central1/bedtime-api

---

## Pulumi state troubleshooting

Pulumi state lives in `gs://bedtime-pulumi-state`. Corruption can happen if a run is interrupted mid-operation.

**Check for issues:**
```bash
cd infra
PULUMI_BACKEND_URL=gs://bedtime-pulumi-state \
  PULUMI_CONFIG_PASSPHRASE="<passphrase>" \
  pulumi stack --stack prod --show-urns
```

**Clear a stale lock (ConcurrentUpdateError):**
```bash
PULUMI_BACKEND_URL=gs://bedtime-pulumi-state \
  PULUMI_CONFIG_PASSPHRASE="<passphrase>" \
  pulumi cancel --stack prod --yes
```

**Inspect/fix state:**
```bash
# Export
PULUMI_BACKEND_URL=gs://bedtime-pulumi-state \
  PULUMI_CONFIG_PASSPHRASE="<passphrase>" \
  pulumi stack export --stack prod > state.json

# Edit state.json, then reimport
PULUMI_BACKEND_URL=gs://bedtime-pulumi-state \
  PULUMI_CONFIG_PASSPHRASE="<passphrase>" \
  pulumi stack import --stack prod --file state.json
```

Known corruption patterns:
- `pendingReplacement: true` on a resource — clear it from state JSON, reimport
- Duplicate URNs (same resource appears twice) — remove the stale entry from state JSON
- Location mismatch between state and code — update the location in both `inputs` and `outputs` in state JSON, reimport, then `pulumi refresh`

---

## Adding a new environment

Currently there is only `prod`. To add `staging`:

1. Create a new Pulumi stack: `pulumi stack init staging`
2. Configure it with appropriate values
3. Add a new GitHub environment with its own secrets
4. Update `deploy.yml` to add staging branches/conditions
