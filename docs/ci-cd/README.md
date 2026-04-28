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

User browser
  └── Cloud Run (europe-west3)  https://bedtime-api-<hash>-ew.a.run.app
        ├── /api/*  → Express API handlers
        └── /*      → packages/web/dist (React SPA, bundled in Docker image)
```

The API and frontend are served from the same Cloud Run URL. This keeps auth cookies on the same origin (HTTP-only, `sameSite: strict`) and eliminates CORS entirely.

---

## What Pulumi manages (infra/index.ts)

Every GCP resource is declared in `infra/index.ts` and managed by Pulumi. Do not create or modify these manually:

- GCP project `bedtime-prod`
- Service API enables (Cloud Run, Artifact Registry, Storage, IAM, Cloud Resource Manager, STS, IAM Credentials)
- Artifact Registry repo `bedtime-api` (Docker, `europe-west3`)
- GCS bucket `bedtime-prod-storage` (versioned, `EUROPE-WEST3`) — reserved for future media/export use
- Service accounts:
  - `bedtime-api@bedtime-prod.iam.gserviceaccount.com` — Cloud Run runtime identity
  - `github-ci@bedtime-prod.iam.gserviceaccount.com` — GitHub Actions CI identity
- IAM bindings for CI SA: `run.admin`, `artifactregistry.writer`, `storage.admin`, `iam.serviceAccountUser`
- Cloud Run service `bedtime-api` (`europe-west3`, public, 3 max instances, 512Mi/1CPU)
- Cloud Run public invoker (`allUsers` → `roles/run.invoker`)

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
| `PROD_REGION` | `europe-west3` |
| `PROD_PROJECT_ID` | `bedtime-prod` |
| `PROD_REGISTRY` | `europe-west3-docker.pkg.dev/bedtime-prod/bedtime-api` |
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

---

## Deploying

### Automatic (push to main)

Every push to `main` triggers the full pipeline: test → infra → deploy.

### Manual dispatch

The workflow can be triggered from the GitHub Actions UI with:

- **Environment** dropdown: selects the target (`prod` only for now)
- **Pulumi refresh checkbox**: when checked, runs `pulumi refresh` before `pulumi up` to sync GCP state into Pulumi. Use this after any manual GCP change or after state corruption recovery. On automatic pushes, refresh always runs.

---

## Rollback

Re-deploy a previous image tag:

```bash
gcloud run deploy bedtime-api \
  --image europe-west3-docker.pkg.dev/bedtime-prod/bedtime-api/api:<PREVIOUS_SHA> \
  --project bedtime-prod \
  --region europe-west3
```

Find available image tags in Artifact Registry: https://console.cloud.google.com/artifacts/docker/bedtime-prod/europe-west3/bedtime-api

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
