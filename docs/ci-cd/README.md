# CI/CD Overview

## Topology

```
GitHub push to main
  └── GitHub Actions
        ├── test  (typecheck + vitest)
        └── deploy
              ├── build Docker image (API + web dist bundled)
              ├── push → Artifact Registry
              └── gcloud run deploy → Cloud Run

User browser
  └── Cloud Run HTTPS URL
        ├── /api/*  → Express API handlers
        └── /*      → packages/web/dist (React SPA)
```

The API and frontend are served from the same Cloud Run service. This keeps auth cookies on the same origin and eliminates CORS entirely.

## Environments

Single environment: **prod**. No staging.

## How to deploy

Push to `main`. GitHub Actions handles the rest automatically.

- The `test` job runs `typecheck` and `vitest`. If either fails, the deploy job does not run.
- The `deploy` job builds the Docker image with the web frontend bundled in, pushes to Artifact Registry, and updates the Cloud Run service.
- Rollback: re-deploy a previous image tag via `gcloud run deploy --image <REGISTRY>/api:<SHA>`.

## Infrastructure management

All GCP resources are managed by Pulumi in `infra/`. See [gcp-setup.md](./gcp-setup.md) for first-time setup.

## GitHub secrets required

| Secret | Description |
|--------|-------------|
| `WIF_PROVIDER` | Workload Identity Federation provider resource name (from `pulumi stack output wifProviderName`) |
| `WIF_SA_EMAIL` | CI service account email (from `pulumi stack output ciSaEmail`) |
| `GCP_PROJECT_ID` | GCP project ID (from `pulumi stack output projectId`) |
| `GCP_REGION` | GCP region, e.g. `us-central1` |
| `ARTIFACT_REGISTRY_URL` | Registry URL (from `pulumi stack output registryUrl`) |
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Min 32-char secret for JWT signing |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `SENTRY_DSN` | Sentry DSN for API error tracking |
| `VITE_SENTRY_DSN` | Sentry DSN embedded in frontend build |
| `SENTRY_ORG` | Sentry org slug (for source map upload) |
| `SENTRY_PROJECT` | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source map upload |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key |
| `LANGFUSE_BASE_URL` | Langfuse base URL (default: `https://cloud.langfuse.com`) |
