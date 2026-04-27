# bedtime-agent

## Tech Stack

### Monorepo structure
npm workspaces with 5 packages:
- `packages/api` — Express 5 HTTP server (`tsx` runtime, no compile step)
- `packages/core` — DB client, Drizzle ORM schema, pipeline logic, auth utils
- `packages/shared` — Money formatting utilities
- `packages/observability` — Sentry + Langfuse initialization
- `packages/web` — React 18 + Vite 5 + React Router 6 + Tailwind/DaisyUI SPA

### Key runtime details
- API entry: `packages/api/src/index.ts` (imports Sentry instrument before server)
- API port: `process.env.PORT ?? 8020`; must set `HOST=0.0.0.0` in containers
- Web port: 8021 (Vite dev server)
- Auth: HTTP-only cookie JWT (Argon2id passwords, HS256 tokens, 8h expiry)
- DB: Neon serverless PostgreSQL via `@neondatabase/serverless` (neon-http driver)

---

## Database

### Neon
The production Neon database lives in org **org-red-darkness-12395804** ("Ilya").

When using Neon MCP tools, always pass `org_id: "org-red-darkness-12395804"`.

Console: https://console.neon.tech/app/org-red-darkness-12395804/projects

### Migrations

Never apply migrations by hand. Always use dedicated commands in package.json files in one of the packages to execute migrations.

Run migrations with: `npm run db:migrate` from the project root.

Never use `drizzle-kit migrate` directly — it uses the `pg` driver which hangs on Neon. The `db:migrate` script uses the neon-http driver instead.

---

## Local Development

Local dev runs via Docker Compose. API uses the same Docker image base as production.

```bash
npm run docker:up      # start API (:8020) + web (:8021)
npm run docker:down    # stop
npm run docker:logs    # stream all logs
docker compose logs -f api   # API logs only
```

Source is mounted as a volume — changes to `packages/` trigger hot reload in both containers.

See `docs/ci-cd/local-dev.md` for full reference.

---

## Cloud Infrastructure (Google Cloud)

### Topology
- **API + frontend**: single Cloud Run service (`bedtime-api`, `us-central1`)
  - The Express API serves `/api/*` and also serves the bundled React SPA for all other routes
  - Cloud Run provides HTTPS automatically
- **Storage**: GCS bucket (`bedtime-storage-<projectId>`) for future use
- **Container registry**: Artifact Registry (`bedtime-api` repo, Docker format)
- **Database**: Neon (external, not GCP)

### IaC
All GCP resources are managed by Pulumi TypeScript in `infra/`.

```bash
cd infra
pulumi preview   # see planned changes
pulumi up        # apply changes
```

First-time setup: see `docs/ci-cd/gcp-setup.md`.

### Cloud Run env vars
Set via GitHub Actions deploy step. Sensitive values stored as GitHub secrets.
Required: `DATABASE_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `SENTRY_DSN`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASE_URL`.

---

## CI/CD

### Pipeline
Push to `main` → GitHub Actions:
1. **test** — `npm run typecheck` + `npm test`
2. **deploy** (only if test passes):
   - Build Docker image (production target, web dist bundled inside)
   - Push to Artifact Registry
   - `gcloud run deploy` updates the Cloud Run service

Auth between GitHub Actions and GCP uses **Workload Identity Federation** (no long-lived keys stored in GitHub).

### Workflow file
`.github/workflows/deploy.yml`

### Required GitHub secrets
See `docs/ci-cd/README.md` for the full secrets table.

### Rollback
```bash
gcloud run deploy bedtime-api \
  --image <REGISTRY>/api:<PREVIOUS_SHA> \
  --project <PROJECT_ID> \
  --region us-central1
```

---

## Docker

### Dockerfile stages
- `base` — node:22-alpine, install all deps
- `development` — tsx watch, mounts source via docker-compose volume
- `web-dev` — Vite dev server for local docker-compose
- `builder` — runs `npm run build:web` (Vite production build)
- `production` — copies web dist from builder, runs `tsx packages/api/src/index.ts`

### Key scripts
```bash
npm run docker:up       # docker compose up
npm run docker:down     # docker compose down
npm run docker:logs     # docker compose logs -f
npm run docker:build    # docker compose build
npm run build:web       # build web frontend (Vite)
```