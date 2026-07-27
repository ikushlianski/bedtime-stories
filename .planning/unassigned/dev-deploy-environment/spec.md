---
type: spec
branch: interactive-story-chat
task: Add a GCP dev deployment environment (web-only), auto-deployed on merge to main; prod becomes manual-only
complexity: complex
state: draft
updated: 2026-07-24
---
# Spec: Dev deploy environment

### Implementation Phases

| Phase | Scenarios | BE Requirements | FE Requirements | Dependencies | Performance Target |
|-------|-----------|------------------|-------------------|---------------|----------------------|
| A — Observability env split | T4, T5 | `APP_ENV` in `sentry-node.ts`/`langfuse-client.ts` | `VITE_APP_ENV` in `instrument.ts`, Dockerfile ARG | None | N/A |
| B — Pulumi stack split | T1, T2, T3, T7, T8 | `infra/index.ts` gated by `pulumi.getStack()`, new `Pulumi.dev.yaml` | None | Phase A not required first, but do it first — cheap and de-risks the rest | N/A |
| C — GitHub Actions trigger rewrite | T1, T2, T3 | `.github/workflows/deploy.yml` — dev job, prod ref restriction | None | Depends on Phase B's stack names existing | N/A |
| D — Secrets, DNS, first deploy | T4, T5, T6, T7, T8 | GitHub `dev` environment, Route53 record, Neon branch, first `pulumi up --stack dev` | None | Depends on B + C | N/A |
| E — Docs | None (infra only) | `docs/ci-cd/README.md`, `docs/ci-cd/gcp-setup.md` rewrite | None | Do last, once the real topology is proven working | N/A |

### Derivers

No derivers — this is infrastructure/config wiring, not business logic. The one code change
(`APP_ENV`/`VITE_APP_ENV` fallback resolution) is a one-line config read in three files, not a named
pure function worth its own unit test per the constitution's "test what earns it."

### Files by scenario

| Scenario | Backend files | Frontend files | Infrastructure files |
|----------|---------------|-----------------|------------------------|
| T1 | None | None | `.github/workflows/deploy.yml` — push trigger targets dev job |
| T2 | None | None | `.github/workflows/deploy.yml` — prod dispatch validates `ref == 'main'` |
| T3 | None | None | `.github/workflows/deploy.yml` — dev dispatch accepts any ref |
| T4 | None — confirms existing `server.ts`/`auth.routes.ts`/`auth.middleware.ts` NODE_ENV gates stay untouched | None | Cloud Run env vars: `NODE_ENV=production` set explicitly for dev too |
| T5 | `packages/observability/src/sentry-node.ts`, `packages/observability/src/langfuse-client.ts` | `packages/web/src/instrument.ts`, `Dockerfile` (new `VITE_APP_ENV` ARG) | Cloud Run/build env: `APP_ENV`, `VITE_APP_ENV` |
| T6 | None — confirms existing `bot: Bot \| null` pattern in `telegram.ts` needs no change | None | Cloud Run env vars for dev: no `TELEGRAM_*` vars set |
| T7 | None | None | `infra/index.ts` (stack-gated foundation + dev-only resources), new `infra/Pulumi.dev.yaml` |
| T8 | None | None | Dev Cloud Tasks queue `bedtime-pipeline-dev`, dev `PIPELINE_QUEUE`/`PIPELINE_WORKER_URL` env vars |

### Files to create

```
infra/Pulumi.dev.yaml                    — dev stack config (gcp:project: bedtime-bootstrap, region, etc.)
.planning/unassigned/dev-deploy-environment/  — this plan
```

### Files to modify

```
infra/index.ts
  Gate `gcp.organizations.Project`, enabled-APIs, Artifact Registry, storage bucket, both service
  accounts, and CI SA IAM bindings behind `pulumi.getStack() === 'prod'` — owned by prod stack only.
  Add stack-conditional blocks for: Cloud Run service `bedtime-api-dev` (dev stack only, referencing
  foundation values as plain constants/config, not resource objects), its public invoker IAM member,
  DomainMapping for `dev.bedtime-agent.ilya.online`, Cloud Tasks queue `bedtime-pipeline-dev`, and the
  two mirrored Cloud Scheduler jobs (catalog-sync-dev, universe-memory-sync-dev).

.github/workflows/deploy.yml
  `push: branches: [main]` triggers the dev deploy path (test -> infra --stack dev -> deploy
  bedtime-api-dev), not prod.
  `workflow_dispatch.inputs.environment` gains `dev` as a choice alongside `prod`.
  A guard step/condition rejects `environment: prod` unless `github.ref == 'refs/heads/main'`.
  New `deploy-dev`/`infra-dev` jobs (or parameterized existing jobs) targeting the `dev` GitHub
  environment's variables/secrets and `bedtime-api-dev`/`Pulumi.dev.yaml`.
  `TELEGRAM_*` env vars omitted entirely from the dev deploy step (no such secrets exist for dev).

packages/observability/src/sentry-node.ts
  `environment: process.env['NODE_ENV'] ?? 'development'` -> prefer `process.env['APP_ENV']`, falling
  back to `NODE_ENV`, so dev vs prod is tagged correctly while NODE_ENV itself stays 'production' in
  both deployed environments.

packages/observability/src/langfuse-client.ts
  Add `environment: process.env['APP_ENV'] ?? 'production'` to the `new Langfuse({...})` constructor
  (native SDK v3.38 field, confirmed in `langfuse-core`'s type definitions).

packages/web/src/instrument.ts
  `environment: import.meta.env.MODE as string` -> prefer `import.meta.env.VITE_APP_ENV`, falling back
  to `MODE`, since both prod and dev images run the same `vite build` (always MODE=production).

Dockerfile
  `builder` stage: add `ARG VITE_APP_ENV=""` and `ENV VITE_APP_ENV=$VITE_APP_ENV` alongside the
  existing `VITE_SENTRY_DSN`/etc. build args.

docs/ci-cd/README.md
  Rewrite "Topology", "Deploying", and the variables/secrets tables to reflect: push-to-main deploys
  dev automatically; prod is manual-dispatch-only, restricted to `ref: main`; dev's own topology
  (shared GCP project, separate Cloud Run service/queue/Neon branch, shared Sentry/Langfuse project).

docs/ci-cd/gcp-setup.md
  Add a new "Adding the dev environment" section replacing the current stale "Adding a new environment"
  placeholder section, documenting the actual steps taken (stack init, resource list, GitHub `dev`
  environment secrets table) so this is reproducible/auditable later.
```

### Data model changes

Not applicable — no schema change. Operational note: the new Neon `dev` branch is a distinct,
persistent database instance from prod's `main` branch; see architecture.md's "Data model evolution".

### Documentation changes

`docs/ci-cd/README.md` and `docs/ci-cd/gcp-setup.md` already cover this exact area and must be updated
(not left stale) — see "Files to modify" above. `docs/architecture/<slug>.md` is not applicable here in
the usual sense (this isn't an app-feature architecture doc), but `architecture.md` in this plan folder
serves as the durable record per this repo's planning convention.

### Prompt testing (BAML)

No BAML/prompt changes in this task.

### Decisions made autonomously

- **GCP topology: same project (`bedtime-prod`), new Cloud Run service** — user-confirmed, recommended
  option; avoids repeating the entire manual WIF/billing bootstrap for a solo-developer project with
  no multi-tenant isolation need.
- **Neon: new persistent `dev` branch off `main`**, distinct from disposable per-feature TTL'd
  branches — user-confirmed.
- **Cloud Scheduler: mirror both nightly jobs into dev** — user-confirmed (overrode the "skip for dev"
  default), full parity with prod.
- **Dev URL: custom subdomain `dev.bedtime-agent.ilya.online`** — user-confirmed once the Route53 cost
  was clarified as $0 incremental (flat per-zone fee already paid, no per-record charge under 10,000
  records; source: aws.amazon.com/route53/pricing).
- **Sentry/Langfuse: shared project with prod, tagged by `environment`** — user-confirmed, matches
  Sentry's own documented guidance (docs.sentry.io/concepts/key-terms/environments: "projects separate
  different services or applications, environments separate different environments... within each").
- **OpenRouter API key and Google OAuth client: fresh, dev-specific** — user-confirmed; these aren't
  project-scoped the way Sentry/Langfuse are, so "fresh key" doesn't conflict with any shared-project
  choice.
- **Prod manual dispatch restricted to `ref == main`** — user-confirmed, closes the "feature branch
  ships straight to prod by accident" risk now that dev absorbs the automatic path.
- **`NODE_ENV` stays `production` on both prod and dev Cloud Run deployments; a new `APP_ENV`/
  `VITE_APP_ENV` pair is introduced purely for observability tagging.** Reason: `NODE_ENV` gates SPA
  static-file serving, auth cookie `Secure` flag, and the `DEV_API_KEY` bypass reachability in existing
  code (`server.ts`, `auth.routes.ts`, `auth.middleware.ts`) — flipping it to `development` on a real,
  internet-reachable dev deployment would break the frontend entirely and weaken auth. This was not
  something the user specified; it's a finding from reading the actual code, surfaced in architecture.md
  rather than silently worked around.
- **Runtime service account, Artifact Registry repo, storage bucket, and `github-ci` SA/WIF binding are
  all reused, not duplicated, for dev.** Reason: all are project-scoped resources whose existing IAM
  grants already cover the new dev resources (e.g. `roles/cloudtasks.enqueuer` and `roles/run.admin`
  are project-level, not resource-scoped) — no new IAM surface needed.
- **Single Pulumi program (`infra/index.ts`) with stack-name gating, not a separate foundation/
  environment program pair with `StackReference`.** Reason: this is a personal-scale project; a full
  cross-stack-reference architecture is more indirection than the actual resource count (three new
  resource types) justifies. The critical safety property — the dev stack must never be able to
  create/destroy the shared project, APIs, registry, bucket, or service accounts — is achieved by the
  `pulumi.getStack() === 'prod'` gate, which is simpler to reason about at this scale.
- **No formal `deriver` for the `APP_ENV`/`NODE_ENV` fallback logic.** Reason: it's a one-line config
  read in three places, not business logic; the constitution's "test what earns it" principle argues
  against manufacturing a unit-tested abstraction for something this small.
- **Dev and prod each get their own `docker build`, never a shared image promoted between
  environments.** Reason: found during grill-me — `VITE_APP_ENV` and `VITE_SENTRY_DSN` are Vite build
  args baked into the static frontend bundle at build time, not runtime-configurable like backend env
  vars. A dev build with `VITE_APP_ENV=dev` is therefore a genuinely different artifact from a prod
  build with `VITE_APP_ENV=production`, even at the same commit SHA. This matches the existing
  structure (each deploy job already runs its own `docker build` step) — no change to that shape, just
  confirming there's no shortcut where one image serves both environments.

### Implementation order

1. Phase A: the three `APP_ENV`/`VITE_APP_ENV` observability edits + Dockerfile ARG — cheap, no
   dependencies, de-risks everything after it.
2. Phase B: restructure `infra/index.ts` (stack gate), write `Pulumi.dev.yaml`, `pulumi stack init dev`.
3. Collect the manual-step values from `todo.md` (OpenRouter key, Google OAuth client, existing
   Sentry/Langfuse values) — needed before the first real `pulumi up --stack dev` and before setting
   GitHub secrets.
4. Create the persistent Neon `dev` branch (Neon MCP).
5. First `pulumi up --stack dev` — creates `bedtime-api-dev`, the dev Cloud Tasks queue, the two
   mirrored Cloud Scheduler jobs, and the DomainMapping resource (cert won't provision until DNS
   resolves).
6. Manual Route53 CNAME for `dev.bedtime-agent.ilya.online`.
7. Create the GitHub `dev` environment + all its variables/secrets via `gh`.
8. Phase C: rewrite `.github/workflows/deploy.yml` (dev auto-trigger, prod ref restriction).
9. Manually dispatch `environment=dev` from **this branch** (`interactive-story-chat`) — the actual
   point of this task, per SCENARIO T3/T8.
10. Verify SCENARIO T4–T8 live (SPA serves, cookies work, no Telegram, Sentry/Langfuse tagging, story
    generation completes end-to-end).
11. Phase E: rewrite `docs/ci-cd/README.md` and `gcp-setup.md` once the real topology is proven working.

### Scope boundary

Out of scope:
- Any change to prod's existing resources, secrets, or deploy behavior beyond the `ref == main`
  restriction on manual dispatch.
- A separate GCP project for dev (explicitly decided against — see "Decisions made autonomously").
- Separate Sentry/Langfuse projects for dev (explicitly decided against).
- Telegram support in dev — web-only, by the task's own framing.
- Any application business-logic or UI change — this task is deploy topology only.
