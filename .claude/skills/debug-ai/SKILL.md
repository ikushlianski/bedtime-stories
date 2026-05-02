---
name: debug-ai
description: |
  Debugs the bedtime-agent story pipeline across Cloud Run, Langfuse, Sentry, Neon DB,
  and local Docker Compose logs.
  Pulls error logs from Cloud Run (gcloud) or local Docker, queries Neon for story/question state,
  fetches traces from Langfuse, and errors from Sentry.

  Trigger when the user asks to debug a story pipeline failure, check why questions/plan/text
  generation failed, inspect a Langfuse trace, investigate a Sentry error in production,
  or check Cloud Run service health. Also trigger on /debug-ai.
allowed-tools: Bash, Read, Write, Grep
---

# Debug AI

Investigates the bedtime-agent story pipeline across signal sources — Cloud Run or local Docker
logs, Neon DB state, Langfuse traces, and Sentry errors.

## Usage

```
/debug-ai
/debug-ai Why did story 30 fail to generate questions?
/debug-ai Show recent Langfuse traces
/debug-ai Sentry errors last 2 hours
/debug-ai logs
/debug-ai story 26
```

`$ARGUMENTS` — optional problem description, story ID, or subcommand. If omitted, run a full
health check across all signal sources.

---

## Environment detection — local vs production

Before running any steps, detect whether the user is debugging locally or in production:

```bash
docker compose ps --services 2>/dev/null | grep -q api && echo "LOCAL" || echo "PRODUCTION"
```

- If **LOCAL**: skip Cloud Run steps; use Docker Compose logs and local Neon DB queries instead.
- If **PRODUCTION**: use Cloud Run (gcloud) and Langfuse/Sentry as documented below.

Check if a `localhost` URL was mentioned in `$ARGUMENTS` — that is also a strong signal for LOCAL.

---

## Environment prerequisites

Load from `.env` at the repo root if environment variables are not already set:

```bash
set -a && source .env 2>/dev/null; set +a
```

**Fixed values for this project:**

- GCP project: `bedtime-prod`
- GCP region: `europe-west3`
- Cloud Run service: `bedtime-api` (single service — API + frontend)
- Sentry org: `ilya-org-jo`
- Sentry project slug: `bedtime-agent`
- Langfuse base URL: read from `LANGFUSE_BASE_URL` env var (default `https://cloud.langfuse.com`)
- Neon org: `org-red-darkness-12395804` (use when querying via Neon MCP)

Required env vars: `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `SENTRY_AUTH_TOKEN`, `DATABASE_URL`.
If any are missing, print a setup hint and exit.

---

## Routing — what to run

Parse `$ARGUMENTS`:

| Pattern | Action |
|---------|--------|
| `langfuse …` or `trace …` | → Step 4 only |
| `sentry …` or `error …` | → Step 5 only |
| `logs …` or `cloud run …` | → Step 2 or Step 3 (based on env) |
| `story <N>` or URL with story ID | → Steps 2/3 + 4 + DB query filtered to that story ID |
| anything else / empty | → full health check: Steps 1 + 2/3 + 4 + 5 + DB |

---

## Step 1 — Cloud Run service health (PRODUCTION only)

### 1a. Service status

```bash
gcloud run services describe bedtime-api \
  --region europe-west3 --project bedtime-prod \
  --format "value(status.conditions[0].status,status.conditions[0].type,status.latestReadyRevisionName)"
```

Expected: `True Ready <revision-name>`. Anything else is a degraded state — report it.

### 1b. Recent revisions

```bash
gcloud run revisions list \
  --service bedtime-api \
  --region europe-west3 --project bedtime-prod \
  --format "table(name,status.conditions[0].type,status.conditions[0].status,creationTimestamp)" \
  --limit 5
```

Flag any recently deployed revision that is not healthy.

---

## Step 2 — Local Docker Compose logs (LOCAL only)

Use these when `docker compose ps` shows the `api` container is running.

### 2a. All recent API logs (last 1 hour)

```bash
docker compose logs api --since 1h 2>/dev/null | tail -200
```

### 2b. Story-specific logs (if story ID provided)

```bash
docker compose logs api --since 2h 2>/dev/null | grep "storyId=<N>"
```

Replace `<N>` with the story ID from `$ARGUMENTS`.

### 2c. Error lines only

```bash
docker compose logs api --since 1h 2>/dev/null | grep -i "error\|failed\|ERR\|fatal" | tail -50
```

---

## Step 3 — Cloud Run logs (PRODUCTION only)

Focus the time window based on the user's problem description if provided, otherwise use the
last 30 minutes.

### 3a. Error logs (highest signal)

```bash
gcloud logging read \
  "resource.type=cloud_run_revision \
   AND resource.labels.service_name=bedtime-api \
   AND (severity>=ERROR OR textPayload=~\"error|Error|ERR|fatal|Fatal\")" \
  --project bedtime-prod \
  --freshness 30m \
  --limit 50 \
  --format "table(timestamp,severity,textPayload,jsonPayload.message)"
```

### 3b. Full log tail

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=bedtime-api" \
  --project bedtime-prod \
  --freshness 30m \
  --limit 100 \
  --format "table(timestamp,severity,textPayload,jsonPayload.message)"
```

### 3c. If the user mentioned a story ID

```bash
gcloud logging read \
  "resource.type=cloud_run_revision \
   AND resource.labels.service_name=bedtime-api \
   AND (textPayload=~\"storyId=<N>\" OR textPayload=~\"story_id.*<N>\" OR jsonPayload.message=~\"<N>\")" \
  --project bedtime-prod \
  --freshness 2h \
  --limit 50 \
  --format "table(timestamp,severity,textPayload,jsonPayload.message)"
```

### What to look for in logs

- **Questions phase failures**: `runStructured` errors, `POST /pipeline/run failed`, invalid model ID
- **Plan phase failures**: `Plotter` or `Psychologist` errors, `plan_failed` status transitions
- **Text phase failures**: `Writer` or `WriterCritic` errors, `text_failed` status transitions
- **OpenRouter API errors**: 429 (rate limit), 503 (provider down), `invalid model ID` (model removed by OpenRouter)
- **Auto mode**: if logs show `plan_running` with no preceding `questions_pending`, the story is in auto mode — questions are intentionally skipped
- **Title generator failures**: model-not-found errors (model may be removed by OpenRouter)
- **Database connectivity**: Neon connection errors, `DATABASE_URL` missing
- **Skill loading**: `Cannot read file` from `packages/core/src/skills/`
- **SSE stream issues**: `[sse]` lines — client connect/disconnect patterns

---

## Step 4 — Neon DB: story and questions state

Always query the DB when a story ID is provided — it reveals the ground truth about what state
the pipeline left the story in, whether questions were generated, and the story's mode.

Use the Neon MCP tool if available (org `org-red-darkness-12395804`), or run via Docker exec:

### 4a. Story state

```bash
docker compose exec api node --input-type=module <<'DBEOF'
import pkg from '/app/node_modules/@neondatabase/serverless/index.mjs'
const { neon } = pkg
const sql = neon(process.env.DATABASE_URL)
const rows = await sql`
  SELECT id, title, status, mode, source, seed,
         plan_v1 IS NOT NULL AS has_plan,
         text_v1 IS NOT NULL AS has_text_v1,
         text_v2 IS NOT NULL AS has_text_v2,
         text_final IS NOT NULL AS has_text_final
  FROM stories WHERE id = <N>
`
console.log(JSON.stringify(rows, null, 2))
DBEOF
```

### 4b. Questions for the story

```bash
docker compose exec api node --input-type=module <<'DBEOF'
import pkg from '/app/node_modules/@neondatabase/serverless/index.mjs'
const { neon } = pkg
const sql = neon(process.env.DATABASE_URL)
const rows = await sql`
  SELECT id, question_text, answer_text
  FROM plan_questions WHERE story_id = <N>
  ORDER BY id
`
console.log(JSON.stringify(rows, null, 2))
DBEOF
```

### What to look for in DB results

- `mode = 'auto'` → questions phase is intentionally skipped; pipeline goes directly to plan
- `mode = 'manual'` or `null` → questions phase should run; if no questions exist, generation failed
- `questions` empty array + `mode = 'auto'` → expected, not a bug
- `questions` empty array + `mode = 'manual'` → question generation failed; check logs
- `has_plan = true` + `status = 'draft'` → plan generated but not yet approved
- `has_text_final = true` → story is fully generated and approved

For production (no Docker), use Neon MCP tool with org `org-red-darkness-12395804`:
- Project: find the bedtime-agent project via `mcp__Neon__` tools
- Run raw SQL against the main branch

---

## Step 5 — Langfuse: traces and prompts

Use the Langfuse CLI for prompt inspection. Use the Langfuse API directly (via curl) for traces
and scores, since the CLI does not expose all query surfaces.

**Note:** Use `/api/public/traces` (v1), not `/api/public/v2/traces` — the v2 endpoint returns a 404.

### 5a. Check CLI availability

```bash
langfuse --version 2>/dev/null || echo "[debug-ai] langfuse CLI not found — using API directly"
```

### 5b. List recent prompt versions

```bash
langfuse prompts list 2>/dev/null
```

If the CLI is unavailable:
```bash
curl -s -H "Authorization: Basic $(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)" \
  "${LANGFUSE_BASE_URL:-https://cloud.langfuse.com}/api/public/prompts" \
  | jq '.data[] | {name, version, updatedAt}'
```

### 5c. Recent traces with errors

```bash
curl -s -H "Authorization: Basic $(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)" \
  "${LANGFUSE_BASE_URL:-https://cloud.langfuse.com}/api/public/traces?limit=20" \
  | jq '.data[] | {id, name, createdAt, sessionId, level}'
```

Traces with `level: "ERROR"` are the first ones to investigate.

If the user provided a trace ID, fetch it directly:
```bash
curl -s -H "Authorization: Basic $(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)" \
  "${LANGFUSE_BASE_URL:-https://cloud.langfuse.com}/api/public/traces/<TRACE_ID>" | jq .
```

If the user mentioned a story ID, filter by session (the pipeline uses `storyId` as the session):
```bash
curl -s -H "Authorization: Basic $(echo -n "${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}" | base64)" \
  "${LANGFUSE_BASE_URL:-https://cloud.langfuse.com}/api/public/traces?sessionId=<STORY_ID>&limit=20" \
  | jq '.data[] | {id, name, createdAt, level, input: (.input | tostring | .[0:120])}'
```

### 5d. Pipeline stage labels to look for in traces

| Langfuse label | What it represents |
|---|---|
| `title-generator` | Title generation after plan phase |
| `plotter-questions` / `skill:plotter-questions` | Question generation phase |
| `plotter:v1` | Plan generation (Plotter agent) |
| `psychologist` | Plan review (Psychologist agent) |
| `writer` | Story text generation (Writer agent) |
| `skill:writer-critic` | Writer critic review |
| `skill:plot-critic` | Plot critic review |

---

## Step 6 — Sentry: production errors

### 6a. Check CLI availability

```bash
sentry-cli --version 2>/dev/null || echo "[debug-ai] sentry-cli not found — install with: brew install getsentry/tools/sentry-cli"
```

### 6b. Recent unresolved issues

```bash
sentry-cli issues list \
  --org ilya-org-jo \
  --project bedtime-agent \
  --query "is:unresolved" \
  --sort date \
  --limit 20 2>/dev/null
```

If the CLI is unavailable:
```bash
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/organizations/ilya-org-jo/issues/?query=is:unresolved&project=4511280431759440&limit=20" \
  | jq '.[] | {id, title, culprit, count, lastSeen}'
```

### 6c. If user gave a specific error message or story ID

```bash
sentry-cli issues list \
  --org ilya-org-jo \
  --project bedtime-agent \
  --query "is:unresolved <error text or storyId>" \
  --limit 10 2>/dev/null
```

### What to correlate

Cross-reference Sentry timestamps with log timestamps and Langfuse trace timestamps.
An error first appearing in logs, then in Sentry, confirms a production exception.
A Langfuse trace that ends abruptly (no completion span) with a matching Sentry error pinpoints
the exact pipeline stage that threw.

---

## Step 7 — Summary report

Always end with a structured summary. Use only what was actually checked.

```
=== bedtime-agent Debug Summary ===

Environment: LOCAL (Docker Compose) / PRODUCTION (Cloud Run)

Story <N> DB state:
  status: <status>  mode: <auto|manual>  source: <ai|user>
  has_plan: yes/no  has_text: yes/no  questions: N rows

Errors found in logs:
  1. <timestamp> — <error>
  2. ...

Langfuse signals:
  Recent traces with errors: N
  Affected story IDs / sessions: <list>
  Pipeline stages that failed: <labels>

Sentry issues (unresolved): N
  Top issue: <title> — last seen <timestamp>

Root cause hypothesis:
  <one or two sentences — what the evidence points to>

Suggested next steps:
  - <action>
```

If no issues are found: "All signals clean. No errors in logs, Langfuse, or Sentry for the
checked time window."

---

## Constraints

| Rule | Detail |
|------|--------|
| Read-only | Never modify code, config, or database — only diagnose |
| No secret printing | Never print raw values of `LANGFUSE_SECRET_KEY`, `SENTRY_AUTH_TOKEN`, `DATABASE_URL`, etc. |
| Local-only | This skill is project-local to bedtime-agent |
