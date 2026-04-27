# Local Development

Local dev runs via Docker Compose. The API container uses the same Docker image as production. The web container runs Vite's dev server with hot reload.

## Prerequisites

- Docker Desktop installed and running
- `.env` file at the repo root with all required variables (copy from `.env.example`)

## Start

```bash
npm run docker:up
# or: docker compose up
```

Services:
- API → http://localhost:8020 (same Docker image as Cloud Run, tsx watch for hot reload)
- Web → http://localhost:8021 (Vite dev server, full hot reload)

## Stop

```bash
npm run docker:down
# or: docker compose down
```

## View logs

```bash
npm run docker:logs
# or: docker compose logs -f

# Single service:
docker compose logs -f api
docker compose logs -f web
```

## Rebuild after dependency changes

```bash
npm run docker:build
# Then: npm run docker:up
```

## Environment variables

Docker Compose reads from `.env` at the repo root. Copy from `.env.example` and fill in values:

```bash
cp .env.example .env
# Edit .env — required: DATABASE_URL, JWT_SECRET, OPENROUTER_API_KEY
```

The containers also receive:
- `PORT=8020`, `HOST=0.0.0.0`, `NODE_ENV=development` (API)
- `VITE_API_URL=http://localhost:8020` (web)

## Hot reload

- **API**: tsx watch detects changes to any TypeScript file under `packages/` and restarts automatically. Source is mounted as a volume.
- **Web**: Vite HMR works as normal. Source is mounted as a volume.

## Running migrations

Migrations run against the real Neon database (same as prod). Run from outside Docker:

```bash
npm run db:migrate
```

## Create a user

```bash
npm run create-user -- <username> <password>
```

## Differences from production

| Local | Production |
|-------|-----------|
| `tsx watch` (hot reload) | `tsx` (single run) |
| PORT 8020 | PORT 8080 |
| Vite dev server on :8021 | Static files bundled in Docker image |
| NODE_ENV=development | NODE_ENV=production |
| Sentry disabled or low sample | Sentry enabled |
