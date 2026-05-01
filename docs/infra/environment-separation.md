# Infrastructure Separation: Dev vs. Production

This project maintains strict separation between local development and production environments to ensure security and data isolation.

## Environment Overview

| Aspect | Development (Local) | Production (Cloud) |
|--------|-----------------|------------|
| **Runtime** | Docker Compose (local machine) | Google Cloud Run (us-central1) |
| **Database** | Neon dev branch | Neon main branch |
| **API Port** | `localhost:8020` | `bedtime-agent.ilya.online` (HTTPS via load balancer) |
| **Web Port** | `localhost:8021` | Bundled in Cloud Run container |
| **Credentials** | `.env` file (git-ignored) | GitHub secrets (never in repo) |
| **DNS** | None | bedtime-agent.ilya.online |

## Development Environment

### Database
- **Neon branch**: `dev`
- **Connection string**: In `.env` file (local, git-ignored)
  - `.env.example` shows the structure
  - `.env` contains actual dev branch URL: `postgresql://neondb_owner:npg_3o...@ep-wandering-salad-akw7r6xo...`
- **Access**: Direct pooler connection from local machine
- **Data**: Development/testing data; safe to reset without consequence

### Credentials
- `.env.example` — template/structure only (checked in, no real values)
- `.env` — actual dev credentials (git-ignored, never committed)
  - Contains real Neon dev branch connection string
  - Contains real API keys for local services (Telegram, Sentry, Langfuse, OpenRouter, Google OAuth)
- **Safe because**: Dev credentials connect only to dev services/database; isolation at the database level

### Running Locally
```bash
npm run docker:up   # Starts API + web from .env DATABASE_URL
npm run docker:down
```

## Production Environment

### Database
- **Neon branch**: `main`
- **Connection string**: `PROD_DATABASE_URL` in GitHub secrets
- **Access**: Pool connections only; isolated network
- **Data**: Live production data; must be protected

### Credentials
- **Never** in the repository, codebase, or `.env` files
- Stored exclusively in GitHub organization secrets
- Accessed by GitHub Actions during deploy step
- Set as environment variables on Cloud Run at deploy time

### Infrastructure as Code
- **Location**: `infra/index.ts` (Pulumi TypeScript)
- **State backend**: Google Cloud Storage (`gs://bedtime-pulumi-state`)
- **What it manages**: 
  - GCP project setup
  - Artifact Registry for container images
  - Cloud Run service definition (resource limits, scaling)
  - Load balancer (HTTPS + domain mapping)
  - Service accounts (GitHub CI, Cloud Run)
- **What it does NOT manage**: Environment variables, database URLs
  - These are injected at deploy time (line 121 of `.github/workflows/deploy.yml`)

### Deploy Flow
1. GitHub Actions runs tests against code
2. Pulumi ensures infrastructure exists (idempotent)
3. Docker image is built and pushed to Artifact Registry
4. `gcloud run deploy` updates the service with new image + env vars from secrets
5. Environment variables from GitHub secrets are set on Cloud Run at this step
6. Load balancer routes HTTPS traffic to the new service version

## Security Boundaries

### Dev Credentials in Repo
- ✅ Safe to check in (dev database credentials)
- Connected only to dev database, which is isolated at Neon
- Developers can inspect and understand the connection setup
- Easy to share and onboard new developers

### Production Credentials NOT in Repo
- ✅ GitHub secrets (encrypted at rest)
- Accessed only by GitHub Actions CI/CD during deploy
- Never logged, printed, or exposed in code
- Rotatable without code changes

### Isolation Layers
1. **Database level**: Dev branch and main branch are separate databases
2. **Network level**: Cloud Run service accounts can only access their assigned resources
3. **Access control**: Only GitHub CI service account can deploy (via Workload Identity Federation)
4. **Build time**: Sensitive build args (like SENTRY_AUTH_TOKEN) injected at Docker build, not committed

## Adding New Secrets

### For Development
1. Add placeholder to `.env.example` with description
2. Developers copy `.env.example` → `.env` and fill in actual values
3. `.env` is git-ignored and never committed
4. Example:
   ```
   # LLM Provider (using OpenRouter for all models)
   OPENROUTER_API_KEY=sk-...
   ```

### For Production
1. Add to GitHub organization secrets as `PROD_<NAME>`
2. Reference in `.github/workflows/deploy.yml` as `${{ secrets.PROD_<NAME> }}`
3. **Never** commit actual values to code, `.env`, or `.env.example`

## Migration Path: Dev Database

When the dev database branch needs to change:
1. Update `ep-wandering-salad-akw7r6xo-pooler.c-3.us-west-2.aws.neon.tech` connection string in:
   - `.env.example`
   - Memory: `reference_neon_dev_branch.md`
   - `.env` file locally (if different)
2. Developers sync their `.env` files to the new connection string
3. Production (main branch) is unaffected

## References

- **Local dev setup**: `docs/ci-cd/local-dev.md`
- **GCP infrastructure setup**: `docs/ci-cd/gcp-setup.md`
- **CI/CD pipeline**: `.github/workflows/deploy.yml`
- **Infra code**: `infra/index.ts`
- **Neon database org**: [Neon console](https://console.neon.tech/app/org-red-darkness-12395804/projects)
