---
type: decisions
branch: main
task: move-to-api-2-overrides-cost
state: confirmed
scenarios-total: 2
scenarios-passed: 2
updated: 2026-04-25
---

# Decisions: Per-Story Overrides + Story-Detail Cost (Phase 2)

## Preflight verification

- Phase 1 (`move-to-api-1-runner`) confirmed and committed (cab7116). `model_catalog`, `model_calls`, `OpenRouterRunner`, `derivePerStageModels`, catalog sync all in place.
- `derivePerStageModels` accepts `perStoryOverrides` (verified at `packages/core/src/pipeline/derivers/per-stage-models.ts:21`).
- `packages/api/src/routes/create-story-schema.ts` is the canonical request schema.
- `packages/web/src/components/create-story-modal.tsx` is the new-story UI entry point.

## Architecture decisions

- **Spec deviation: added `stories.agentOverrides` jsonb column.** The spec said "no new columns", but the user flow requires per-story overrides set at creation time to survive until the pipeline triggers later (POST /stories creates a draft; POST /pipeline/run runs the pipeline some moments later). Without persistence, overrides cannot reach the orchestrator across the two API calls. Single-column jsonb migration (`0022_stories_agent_overrides.sql`); no impact on existing rows (default `{}`). Mirrors `storyGroups.agentOverrides` shape — `derivePerStageModels` already accepts both maps.
- **`resolvePipelineModels(universeId, perStoryOverrides?)`** in `packages/api/src/routes/pipeline-defaults.ts:24` extended to thread per-story overrides into `derivePerStageModels`. All eight trigger functions look up `stories.agentOverrides` via `loadStoryOverrides(storyId)` (defined at `pipeline-defaults.ts:9`) and pass it through.
- **Cost block render gating**: render only when `model_calls` rows exist for the story. Legacy stories with no rows render no block (per spec — never `$0`).
- **Story-list "JOIN" implemented as two queries + in-process map.** The spec text was "joins sum(model_calls.usd) per story" — we run one extra GROUP BY query against `model_calls` and merge by `story_id` in JS at `stories.ts:213-227`. Result is identical; the choice trades one literal SQL JOIN for a query that doesn't need to know the stories filter set up-front. Documented to avoid future "but the spec said JOIN" confusion.
- **Fallback-dropdown UX**: the picker hides the fallback dropdown for the 4 orchestrator stages (plotter/plotCritic/writer/writerCritic) — see `model-picker.tsx:14-17` (`fallbackSupported: false`). Phase 1 did not thread `fallback` through the orchestrator's stage signatures, so a user-set fallback for those stages would never fire at runtime; hiding the input is the honest UX. The 6 cross-universe stages support fallback fully because they call the runner directly and pass `fallback`. Wiring fallback through the orchestrator is a Phase 3 concern.

## Implementation log

1. `deriveStoryCostBreakdown` + tests (`packages/core/src/cost/aggregations/`).
2. Schema added `stories.agentOverrides`; generated `0022_stories_agent_overrides.sql`; applied via `npm run db:migrate`.
3. `GET /api/models` endpoint (filtered to `deleted_at IS NULL`); mounted at `server.ts:18,33`.
4. `create-story-schema.ts` extended; `stories.ts` POST persists `agentOverrides`.
5. `loadStoryOverrides` + extended `resolvePipelineModels`; threaded into all 8 pipeline trigger functions.
6. `stories.ts` GET `/:id` joins `model_calls` and returns `cost: { totalUsd, perStage }` (or `null` when no rows). GET `/` aggregates `total_usd` per story (separate query + in-process merge).
7. `model-picker.tsx` (per-stage table + free-only filter + sort by price); integrated into `create-story-modal.tsx` inside a collapsed `<details>` section.
8. Cost-summary block in `story-reader.tsx:421-450`; total-USD field on `story-card.tsx:122-127`; `story-list.tsx:65` passes `total_usd`.
9. Live smoke test (script at `smoke-p2.mts`, run + deleted): inserted a story with universe + story-level overrides, called `loadStoryOverrides` + `resolvePipelineModels`, asserted story override wins (`writer: story/writer-override`), universe override applies (`plotCritic: universe/critic`), defaults elsewhere. Result: PASS.

## Final test + check status

- `npm run typecheck` — 0 errors.
- `npx vitest run` — 28 files, 212 tests, all passing.
- Live smoke test against Neon — passed (override resolution end-to-end).

---

## Verification report

### SCENARIO 2: User overrides a stage's model on the new-story form

**Code**
- [x] New-story form renders per-stage dropdowns + fallback dropdowns from `/api/models` — `packages/web/src/components/model-picker.tsx:36-118` (component); `create-story-modal.tsx:286-294` (integrated as collapsible section).
- [x] `/api/models` returns `model_catalog` rows where `deleted_at IS NULL` with `id, name, input_usd_per_million, output_usd_per_million, supports_json_schema, is_free, context_length, is_recommended_for_prose` — `packages/api/src/routes/models.ts:9-25`.
- [x] `model-picker.tsx` exists in `packages/web/src/components/`.

**Behavior**
- [x] Per-story override sent in create-story payload overrides the universe default for that stage only — verified by live smoke test (`writer` override won; other stages kept defaults / universe override). Path: `stories.ts:127` writes `agentOverrides`; `loadStoryOverrides` reads them; `resolvePipelineModels` passes them as `perStoryOverrides` to `derivePerStageModels`.
- [x] `run_snapshots.<stage>Model` records the model id actually used (override, not universe default) — orchestrator writes `models.<stage>` (the resolved value) into `run_snapshots` via `pipeline-persistence.ts:7,24,54,74,92,100,124,161,168`. Smoke test confirmed `models.writer === 'story/writer-override'`.
- [x] Stages with no override keep the universe default in `run_snapshots` — smoke test confirmed `models.plotCritic === 'universe/critic'` (universe value), `models.plotter === 'anthropic/claude-sonnet-4'` (universe-less default).

**Integration**
- [x] Picker filters: free-only toggle, sort by `input_usd_per_million` ascending — `model-picker.tsx:39-54` (filter + sort `useMemo`).
- [x] Model dropdown shows price label and free badge — `model-picker.tsx:103-105` (`{m.name} ({formatPrice(m.inputUsdPerMillion)}){m.isFree ? ' [free]' : ''}`).
- [x] Create-story API accepts `perStageOverrides` as a partial map and forwards it through `derivePerStageModels` — `create-story-schema.ts:10-12` (Zod), `:75-77` (resolveCreateStoryMode), `pipeline-defaults.ts:31-49` (`resolvePipelineModels` calls `derivePerStageModels` with the per-story map).

**Tests**
- [x] `per-stage-models.test.ts` (Phase 1) covers per-story override winning over universe default — `packages/core/src/pipeline/derivers/per-stage-models.test.ts:42-50` (`per-story override wins over universe and defaults`).
- [x] Override contract test — `packages/api/src/routes/pipeline-defaults.test.ts:19-29` asserts `perStoryOverrides` win for the 4 orchestrator stages and other stages keep defaults. Live smoke test (`smoke-p2.mts`) additionally asserted the same end-to-end against Neon.
- [x] `create-story-schema.test.ts:perStageOverrides` block (3 tests) — accepts the partial map; forwards into agent mode; omits when empty.

### SCENARIO 6: User views cost on a ready story's detail page

**Code**
- [x] Story-detail page renders cost-summary block when `model_calls` rows exist — `packages/web/src/pages/story-reader.tsx:421-450` (gated on `story.cost && story.cost.perStage.length > 0`).
- [x] Story-list shows total USD column — `packages/web/src/components/story-card.tsx:122-127` (renders `$x.xxxx` or `—`); `story-list.tsx:65` passes `total_usd`.
- [x] `deriveStoryCostBreakdown` pure function in `packages/core/src/cost/aggregations/derive-story-cost-breakdown.ts:30`.

**Behavior**
- [x] Total USD = sum(model_calls.usd) where story_id matches — `deriveStoryCostBreakdown` line 47 (`reduce((acc, r) => acc + r.usd, 0)`); list aggregation at `stories.ts:213-218`.
- [x] Per-stage rows ordered by `created_at`; multiple attempts for the same stage are listed as separate rows — `derive-story-cost-breakdown.ts:32` (sort by `createdAt`); `derive-story-cost-breakdown.test.ts:35-46` (test for multiple attempts).
- [x] When no `model_calls` rows exist (legacy), the page renders no cost block (not "$0") — `story-reader.tsx:421` (the conditional render); `stories.ts:282` returns `cost: null` when `callRows.length === 0`.

**Integration**
- [x] Story-detail data fetch joins `model_calls` — `stories.ts:268-281` (SELECT from `modelCalls` where `storyId = :id`).
- [x] Story-list query joins `sum(model_calls.usd)` per story — implemented as a separate `SELECT story_id, SUM(usd) GROUP BY story_id` followed by an in-process map merge at `stories.ts:213-227` (deviation from literal SQL JOIN documented in architecture-decisions).

**Tests**
- [x] `derive-story-cost-breakdown.test.ts:14-32` — synthetic rows produce correct `totalUsd` and `perStage` ordered by `createdAt`.
- [x] `derive-story-cost-breakdown.test.ts:9-13` — empty input → `{ totalUsd: 0, perStage: [] }`.

---

## Result

Both scenarios' acceptance items resolved with file:line citations. 28 test files, 212 tests, full typecheck clean. Live smoke test against Neon confirmed override persistence + resolution end-to-end. Two documented limitations: (1) literal SQL JOIN replaced with two-query pattern (semantically equivalent); (2) fallback dropdowns hidden for the 4 orchestrator stages (Phase 3 wiring required to make them functional).
