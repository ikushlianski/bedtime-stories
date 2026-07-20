---
type: spec
branch: story-retrieval
task: Give the plotter/writer real retrieval capability over past stories, not just pre-fetched context (GH #297)
complexity: complex
state: confirmed
updated: 2026-07-21
---
# Spec: Story retrieval (vector search + tool-calling)

### Why

Today the orchestrator pre-fetches a small, fixed set of context (memorable moments, style guide,
character bible) via plain SQL before the prompt is even built. The model never decides to look
anything up — everything it might use is either pushed to it in advance or not available at all.
This task gives the plotter a real, model-initiated retrieval capability: a `search_past_stories`
tool backed by vector search over embedded past-story text, invoked only when the model itself
judges a callback would help, not injected unconditionally.

### Implementation Phases

Single phase. The storage layer, the embedding pipeline, the runner's tool-calling capability, and
the plotter wiring are one cohesive unit — a tool with no embeddings behind it does nothing useful,
and embeddings with no tool-calling runner support are unreachable.

### Derivers

| Deriver | Inputs | Output | Scenarios covered |
|---------|--------|--------|--------------------|
| `deriveEmbeddingInput` (new, `pipeline/embed-story.ts`) | a story row (`textFinal`, `textV2`, `textV1`, existing `content_hash` if any) | `{ text: string; contentHash: string } \| null` (null when no usable text) | SCENARIO 1, 2, 9 |
| `deriveSearchPastStoriesArgs` (new, `pipeline/search-past-stories-tool.ts`) | raw JSON args string from the model's tool call | `{ query: string; limit: number } \| { error: string }` — validates via zod, clamps `limit` into `[1, 5]` regardless of what was requested | SCENARIO 3, 6 |
| `deriveSearchPastStoriesResult` (new, `pipeline/search-past-stories-tool.ts`) | raw DB rows (title, text, distance) for a query | `{ results: Array<{ storyTitle, text, similarity }> } \| { results: []; note: string }` | SCENARIO 3, 4, 5 |
| `deriveToolLoopMessages` (new, `openrouter/derive-tool-loop-messages.ts`) | current messages array, assistant message with `tool_calls`, array of `{ tool_call_id, result }` | next messages array (assistant tool-call message + one `role: 'tool'` message per result) | SCENARIO 6 |
| `clampToolIterations` (new, `openrouter/derive-tool-loop-messages.ts`) | requested max iterations (optional caller override) | a number hard-capped at `MAX_TOOL_ITERATIONS = 3` regardless of input | SCENARIO 6 |

### Files by scenario

| Scenario | Backend files | Frontend files | Infrastructure files |
|----------|---------------|-----------------|------------------------|
| SCENARIO 1 — one-time backfill | `packages/api/src/routes/internal-embed-story-backfill.ts`, `packages/core/src/pipeline/embed-story.ts` | None | None |
| SCENARIO 2 — auto-embed on approval | `packages/api/src/routes/story-analysis.ts`, `packages/core/src/pipeline/embed-story.ts` | None | None |
| SCENARIO 3 — plotter retrieves on its own initiative | `packages/core/src/pipeline/stages/plotter.ts`, `packages/core/src/pipeline/orchestrator.ts`, `packages/core/src/pipeline/search-past-stories-tool.ts`, `packages/core/src/openrouter/openrouter.runner.ts` | None | None |
| SCENARIO 4 — empty-universe retrieval | `packages/core/src/pipeline/search-past-stories-tool.ts` | None | None |
| SCENARIO 5 — no cross-universe leakage | `packages/core/src/pipeline/search-past-stories-tool.ts`, `packages/core/src/db/schema.ts` | None | None |
| SCENARIO 6 — bounded tool loop | `packages/core/src/openrouter/openrouter.runner.ts`, `packages/core/src/openrouter/derive-tool-loop-messages.ts` | None | None |
| SCENARIO 7 — internal endpoint auth | `packages/api/src/routes/internal-embed-story-backfill.ts` | None | `.github/workflows/deploy.yml` (secret wiring) |
| SCENARIO 8 — pgvector migration idempotency | `packages/core/src/db/schema.ts` | None | `packages/core/src/db/migrations/0044_story_embeddings.sql` |
| SCENARIO 9 — backfill re-run is a no-op | `packages/core/src/pipeline/embed-story.ts` | None | None |
| SCENARIO 10 — deleting a story removes its embedding | `packages/api/src/routes/stories.ts` | None | None |

### Files to create

```
packages/core/src/db/migrations/
  0044_story_embeddings.sql          — hand-authored (drizzle-kit does not model CREATE EXTENSION
                                        or the vector column reliably); idempotent:
                                        CREATE EXTENSION IF NOT EXISTS vector;
                                        CREATE TABLE IF NOT EXISTS story_embeddings (...);
                                        CREATE INDEX IF NOT EXISTS story_embeddings_universe_idx
                                          ON story_embeddings(universe_id);

packages/core/src/openrouter/
  tool-types.ts                      — ToolDefinition interface (name, description, JSON-schema
                                        parameters) + OpenAI/OpenRouter wire-format mapper
  derive-tool-loop-messages.ts       — deriveToolLoopMessages, clampToolIterations
  derive-tool-loop-messages.test.ts

packages/core/src/pipeline/
  embed-story.ts                    — deriveEmbeddingInput, embedStory(storyId),
                                        embedStoriesBatch(storyIds) — embedStory delegates to the
                                        batch function with a one-element array
  embed-story.test.ts
  search-past-stories-tool.ts       — SEARCH_PAST_STORIES_TOOL (ToolDefinition),
                                        deriveSearchPastStoriesArgs, deriveSearchPastStoriesResult,
                                        searchPastStories(...)
  search-past-stories-tool.test.ts

packages/api/src/routes/
  internal-embed-story-backfill.ts  — secret-gated POST, calls embedStoriesBatch over
                                        status='read' stories missing/stale embeddings
  internal-embed-story-backfill.test.ts

docs/architecture/
  story-retrieval.md                — new architecture doc + Mermaid diagram (this flow doesn't
                                        exist in any of 01–05 today) + a rendered PNG/`.mmd` pair
                                        under diagrams/ and img/, matching the existing docs'
                                        convention
```

### Files to modify

```
packages/core/src/db/schema.ts
  + storyEmbeddings table: id (serial PK), storyId (integer, FK -> stories.id, unique),
    universeId (integer, FK -> storyGroups.id, nullable), embedding (vector('embedding',
    { dimensions: 1536 }) — drizzle-orm 0.45.2's native pg-core vector column type, confirmed
    present in this repo's installed version), contentHash (text, not null), embeddingModel
    (text, not null, default 'openai/text-embedding-3-small'), createdAt, updatedAt (timestamps)

packages/core/src/openrouter/openrouter.client.ts
  + embed(input: string[], model = 'openai/text-embedding-3-small'): Promise<{ embeddings:
    number[][]; usage: OpenRouterUsage }> — POST to /embeddings, same authHeaders/error handling
    as chatNonStream/chatStream
  + ChatRequest gains optional tools?: ToolDefinition[] (mapped to OpenAI's
    { type: 'function', function: {...} } wire shape) and tool_choice left at its API default
  + chatNonStream's response parsing extracts message.tool_calls (array of
    { id, function: { name, arguments } }) alongside the existing content/usage extraction

packages/core/src/ai/runner.interface.ts
  RunTextOptions gains: tools?: ToolDefinition[]; executeTool?: (name: string, argsJson: string)
    => Promise<unknown>; maxToolIterations?: number (optional override, still clamped by
    clampToolIterations)

packages/core/src/openrouter/openrouter.runner.ts
  runText: when options.tools is present, branches into a bounded non-streaming loop (uses
    chatNonStream per iteration, up to clampToolIterations(options.maxToolIterations) rounds)
    instead of the existing chatStream path; on each iteration, executes any tool_calls in the
    response via options.executeTool (Promise.all, capped per iteration), appends results via
    deriveToolLoopMessages, and continues until the model returns a plain assistant message or the
    cap is hit; the final text is returned and, if options.onChunk was provided, delivered as one
    call for interface compatibility. Every iteration is still recorded via the existing
    costRecorder.record(...) call and a Langfuse annotation records tool-call count. Callers that
    don't pass tools see the exact current behavior (chatStream path), unchanged.

packages/core/src/pipeline/stages/plotter.ts
  runPlotter options gain universeId?: number | null. When set, builds SEARCH_PAST_STORIES_TOOL +
    an executeTool closure calling searchPastStories({ universeId, excludeStoryId: options.storyId,
    ...parsedArgs }), and passes both into the aiRunner.runText(...) call. When unset (null or
    undefined), no tools are attached — identical to today's call.

packages/core/src/pipeline/orchestrator.ts
  the plotter call sites (runPlotter, ~line 129/300 per today's file) pass universeId:
    options.universeId ?? null — the value is already resolved there for loadMemorableMoments, so
    this is threading an existing value one level deeper, not a new fetch.

packages/api/src/routes/story-analysis.ts
  analyzeStoryAndLearn gains embedStory(storyId).catch((err) => console.error(...)) called
    unconditionally near the top of the function, right after the story's text is confirmed to
    exist — deliberately outside the if (story.groupId !== null) block that gates the
    style-guide/fact-extraction Promise.all, since embedding itself has no universe dependency
    (it stores whatever groupId the story currently has, including null) and this matches the
    backfill path, which also embeds candidates with no groupId gate. Added as an independent,
    separately-caught call so an embedding failure never fails the surrounding function (mirrors
    how runUniverseFactExtractor is already isolated with its own .catch())

packages/api/src/routes/stories.ts
  DELETE /:id handler (~line 1088-1112) gains db.delete(storyEmbeddings).where(eq(
    storyEmbeddings.storyId, storyId)) alongside the existing explicit per-table deletes
    (annotations, runSnapshots, feedback, planQuestions, planConversations, storyReadings,
    modelCalls, storyTextVersions) that already run before stories itself is deleted — this repo
    has no onDelete: 'cascade' on any FK (confirmed by reading schema.ts), so story_embeddings'
    FK to stories.id would otherwise reject the delete outright once a story has an embedding row

packages/api/src/server.ts
  + import internalEmbedStoryBackfillRouter from './routes/internal-embed-story-backfill'
  + app.use('/api/internal/embed-story-backfill', internalEmbedStoryBackfillRouter) — mounted
    alongside the existing internal-catalog-sync / internal-backfill / internal-worker /
    internal-universe-memory-sync mounts

.github/workflows/deploy.yml
  + --set-env-vars="EMBEDDING_BACKFILL_SECRET=${{ secrets.PROD_EMBEDDING_BACKFILL_SECRET }}"
    added to the Cloud Run deploy step (mirrors BACKFILL_SECRET at ~line 158) — no Pulumi config
    block change, since this route has no Cloud Scheduler job needing the secret injected as a
    header

docs/ci-cd/README.md
  + add PROD_EMBEDDING_BACKFILL_SECRET to the existing Secrets table (same treatment as every
    other per-feature secret already listed there)

docs/architecture/README.md
  + add a row for the new story-retrieval.md doc in the existing table
```

### Data model changes

New table `story_embeddings` — see `architecture.md`'s "Data model evolution" for full column
detail. One row per story (unique on `story_id`), no chunking: story text (800–1200 words) fits
comfortably within `text-embedding-3-small`'s 8191-token input limit, so embedding the whole story
as a single vector is both simpler and sufficient — chunking would only earn its complexity at
retrieval granularity finer than "recall a whole past story," which nothing in the wishlist's
"Done when" criteria asks for. Generated via a hand-authored idempotent migration (not
`drizzle-kit generate`, since the `vector` column type and `CREATE EXTENSION` need explicit
control), applied via `npm run db:migrate` per project `CLAUDE.md` — never `drizzle-kit migrate`
directly, and never pushed by hand. The FK to `stories.id` carries no `onDelete: 'cascade'` —
matching every other FK in this schema (`schema.ts` uses no cascades anywhere) — so
`DELETE /stories/:id` is updated to explicitly delete the story's `story_embeddings` row first,
the same way it already explicitly deletes from `annotations`, `feedback`, `storyTextVersions`,
etc. before deleting the story itself (SCENARIO 10). Without this, deleting an embedded story
would fail with a foreign-key violation, not silently succeed.

No changes to `stories` or `story_groups`.

### Documentation changes

- `docs/architecture/README.md` — add a row for the new doc (existing table, direct addition).
- No existing doc under `docs/architecture/` covers embeddings, retrieval, or tool-calling
  (confirmed by reading `01-system-overview.md` through `05-data-model.md`'s scope in this
  planning session — none mention vectors, tool calls, or an `/embeddings` endpoint). New:
  `docs/architecture/story-retrieval.md`, containing the Mermaid diagram from this plan's
  `architecture.md` plus prose explaining the two new flows (auto-embed-on-approval / backfill,
  and the plotter's tool-calling round trip), following the existing docs' convention of a
  Markdown file with an inline diagram plus a rendered PNG under `img/` and `.mmd` source under
  `diagrams/`.
- `docs/ci-cd/README.md` — add the new `PROD_EMBEDDING_BACKFILL_SECRET` row to the existing
  Secrets table.

### Decisions made autonomously

- **Retrieval mechanism, embedding provider (OpenRouter / `openai/text-embedding-3-small`), and
  storage (pgvector on Neon) were resolved directly with the user in conversation before planning
  began; plan auto-confirmed after consistency gate passed with 0 gaps.**
- **Tool wired into the plotter only, not the writer.** Reason: the writer streams token-by-token
  to the UI via `onChunk` (`emitPipelineEvent(storyId, { type: 'chunk', ... })` in
  `pipeline-text-trigger.ts`/`pipeline-text-rewrite.ts`) — the app's live-generation UX. A
  tool-calling loop fundamentally requires non-streaming round trips (the model must see a tool
  result before continuing), so wiring it into the writer would either silently degrade that live
  streaming (batching the whole story into one final `onChunk`) on every generation that happens to
  invoke the tool, or require accumulating streamed `tool_calls` deltas — meaningfully more
  complexity for a capability the plotter already fully satisfies. The plotter's `runPlotterOnly`/
  `runPlotter` call sites are confirmed to run as a single awaited call with no `onChunk` wiring in
  their API routes today, so there is no existing UX to protect there. This fully satisfies the
  wishlist's "Done when" (worded as "the writer *or* plotter"). Writer-side retrieval is a clean,
  independent follow-up if ever needed — nothing here forecloses it.
- **No ANN index (HNSW/IVFFlat) on `story_embeddings.embedding`.** Reason: the corpus is ~67 rows
  today and will grow by roughly one row per approved story — a full sequential scan with pgvector's
  `<=>` cosine-distance operator is sub-millisecond at this scale. Adding an ANN index now would
  introduce an unverified dependency (Neon's currently-provisioned pgvector extension version
  supporting HNSW) for zero measurable benefit. Revisit if the corpus grows into the thousands.
- **One embedding per story, no chunking.** Reason: see "Data model changes" above — story length
  fits the embedding model's input limit with wide margin, and nothing in the done-when criteria
  needs sub-story retrieval granularity.
- **`runText` gains tool-calling as an opt-in branch, not a new `AiRunner` method.** Reason: keeps
  the `AiRunner` interface at two methods; every existing caller of `runText` (writer, and any
  future stage) is unaffected unless it explicitly passes `tools`, which is the smallest possible
  surface change for adding genuinely new capability. A parallel `runTextWithTools` method was
  considered and rejected — it would fork the retry/fallback/cost-recording logic that already
  lives once in `runText` today.
- **Tool-loop iterations use `chatNonStream`, never `chatStream`, even though `runText` normally
  streams.** Reason: tool-calling requires seeing the complete assistant response (including any
  `tool_calls`) before deciding whether to continue the loop or return — accumulating a streamed
  response's tool-call deltas is real additional complexity this task doesn't need, since the
  plotter (the only caller wired to this path) never streams to the UI today.
- **`MAX_TOOL_ITERATIONS = 3`, hardcoded in the runner, not configurable via prompt or environment
  variable.** Reason: per this repo's mandatory agentic-development principles, iteration limits
  must be hard limiters in code, not left to model behavior or a prompt instruction the model could
  ignore or a config value that could be misconfigured to be unbounded.
- **Backfill is a manually-triggered one-off endpoint, not a Cloud Scheduler job.** Reason: ongoing
  embedding already happens automatically at story-approval time (SCENARIO 2); the backfill only
  exists to seed the 67 pre-existing `read` stories once. A recurring job for a task that becomes a
  true no-op after its first successful run (SCENARIO 9) is unnecessary infrastructure — this
  mirrors the existing `internal-backfill.ts` route (stalled-pipeline retries), which is also
  manually triggered with no Scheduler job behind it.
- **Backfill secret wired only into `.github/workflows/deploy.yml`'s Cloud Run env vars, no Pulumi
  config entry.** Reason: `catalogSyncSecret`/`universeMemorySyncSecret` are Pulumi config secrets
  because Pulumi itself injects them into a Cloud Scheduler job's HTTP header; `BACKFILL_SECRET`
  (the existing analogous one-off endpoint) has no such Scheduler job and is wired purely as a
  Cloud Run env var — this new secret follows that same, simpler precedent since it also has no
  Scheduler job.
- **`story_embeddings.storyId`'s FK carries no `onDelete: 'cascade'`; `DELETE /stories/:id`
  explicitly deletes the row instead.** Reason: this repo's schema uses no cascading FK anywhere —
  every dependent table is deleted explicitly, in a fixed order, inside the existing delete
  handler. Introducing the first cascading FK in this schema for one new table would be an
  inconsistent, easy-to-miss precedent; matching the established explicit-delete pattern is both
  more consistent and was directly necessary — without it, deleting any embedded story would fail
  outright with a foreign-key constraint violation (SCENARIO 10).
- **`content_hash` (SHA-256 of embedded text) exists purely for idempotency, not security.** Reason:
  it lets both the backfill and the approval-time trigger cheaply skip re-embedding unchanged text
  (SCENARIO 9) without needing to compare full text strings or always re-call the embeddings API.
- **Retrieval tool errors return structured JSON, never throw out of `executeTool`.** Reason: per
  this repo's mandatory agentic-development principles, tool errors must be actionable and
  non-fatal to the surrounding generation — a retrieval failure should degrade to "the plotter
  proceeds without that callback," identical in effect to an empty result (SCENARIO 4), never to a
  failed story generation.
- **`limit` param is clamped server-side to `[1, 5]` regardless of the JSON-schema bound already
  declared in the tool's `parameters`.** Reason: defense in depth — a model is not guaranteed to
  respect a declared schema bound, and a large `limit` would both inflate cost and context size
  unnecessarily, so the constraint exists in code, not only in the tool's documented contract.
- **Plan auto-confirmed (no human present overnight to review) — Complex path, consistency gate
  passed with 0 gaps** (all 8 checks: scenario→acceptance, deriver→scenario, scenario→coverage,
  diagram→scenario, todo→spec, constitution, scenario→files-by-scenario, documentation).

### Implementation order

1. Schema: add `storyEmbeddings` to `packages/core/src/db/schema.ts`; hand-author
   `0044_story_embeddings.sql` (extension + table + index, idempotent); generate/run via
   `npm run db:migrate` — covers SCENARIO 8.
2. `/tdd deriveEmbeddingInput` — covers SCENARIO 1, 2, 9.
3. `embed-story.ts`: `embedStory`/`embedStoriesBatch` async controllers (OpenRouterClient.embed +
   upsert on `story_id`, skip-on-matching-hash) — covers SCENARIO 1, 2, 9.
4. `openrouter.client.ts`: add `embed(...)`, extend `ChatRequest`/response parsing for
   `tools`/`tool_calls` — no scenario directly, foundational for SCENARIO 3, 6.
5. `/tdd deriveToolLoopMessages` + `/tdd clampToolIterations` — covers SCENARIO 6.
6. `openrouter.runner.ts`: bounded tool loop branch in `runText` — covers SCENARIO 3, 6.
7. `/tdd deriveSearchPastStoriesArgs` + `/tdd deriveSearchPastStoriesResult` — covers SCENARIO 3,
   4, 5, 6.
8. `search-past-stories-tool.ts`: `searchPastStories` async controller (embed query, pgvector
   query filtered by `universe_id`, excluding current story) — covers SCENARIO 3, 4, 5.
9. `plotter.ts` + `orchestrator.ts`: wire `universeId` through, attach tool + `executeTool` — covers
   SCENARIO 3.
10. `internal-embed-story-backfill.ts` (secret check, batch over `status='read'` candidates) +
    mount in `server.ts` — covers SCENARIO 1, 7, 9.
11. `story-analysis.ts`: add the independently-caught `embedStory(storyId)` call — covers
    SCENARIO 2.
12. `stories.ts`: add the explicit `story_embeddings` delete to the existing `DELETE /:id`
    handler — covers SCENARIO 10.
13. Infra: `.github/workflows/deploy.yml` env var wiring — covers SCENARIO 7 (infra half).
14. Docs: `docs/architecture/story-retrieval.md` + diagram assets, `docs/architecture/README.md`
    row, `docs/ci-cd/README.md` secrets table row.

### Definition of Done — per layer

**Backend:**
`npx vitest run packages/core/src/pipeline/embed-story.test.ts
packages/core/src/pipeline/search-past-stories-tool.test.ts
packages/core/src/openrouter/derive-tool-loop-messages.test.ts` passes, covering: (a)
`deriveEmbeddingInput` returns `null` for a story with no `textFinal`/`textV2`/`textV1`, and a
`{ text, contentHash }` pair otherwise, with a stable hash for identical text (SCENARIO 1, 2, 9);
(b) `deriveSearchPastStoriesArgs` clamps a requested `limit` of `500` down to `5` and rejects a
non-string `query` with an `{ error }` result (SCENARIO 6); (c) `deriveSearchPastStoriesResult`
returns `{ results: [], note: '...' }` for an empty row set and a populated `results` array
otherwise (SCENARIO 4); (d) `clampToolIterations` never returns a value above
`MAX_TOOL_ITERATIONS` regardless of input (SCENARIO 6); (e) `deriveToolLoopMessages` appends
exactly one `role: 'tool'` message per tool result, each tagged with its `tool_call_id`
(SCENARIO 6). Additionally, after running the migration and the backfill locally:
`curl -s -X POST http://localhost:8020/api/internal/embed-story-backfill -H
"X-Embedding-Backfill-Secret: wrong"` returns `401`; the same call with the correct local secret
returns `200` with `{"ok":true,"embedded":<N>,"skipped":[...],"failed":[...]}` where `N` matches
`SELECT count(*) FROM stories WHERE status = 'read'` minus any story with no usable text; running
that same authenticated call a second time immediately after returns `"embedded":0` (SCENARIO 9).
Finally, a direct SQL check proves retrieval actually works end to end:
`SELECT story_id, embedding <=> (SELECT embedding FROM story_embeddings WHERE story_id =
<some_story_id>) AS distance FROM story_embeddings WHERE universe_id = <that story's universe_id>
ORDER BY distance LIMIT 5;` returns the queried story itself at `distance = 0` and a plausible
ranked list of other same-universe stories — proving the vectors are populated and comparable, not
just present. One more direct check: `DELETE /stories/:id` (via the app's existing delete route)
on a story that has a `story_embeddings` row succeeds with its normal response, and a follow-up
`SELECT * FROM story_embeddings WHERE story_id = <deleted id>;` returns zero rows — proving the
delete path was actually updated and doesn't just happen to not error (SCENARIO 10).

**Infrastructure:**
`SELECT extname FROM pg_extension WHERE extname = 'vector';` against the dev Neon branch returns
one row after `npm run db:migrate` runs (extension enabled). `\d story_embeddings` (or the
equivalent `information_schema.columns` query) shows `embedding` as `USER-DEFINED` / `vector` type
with the table's other columns as specified. Re-running the same migration file's statements a
second time via `npm run db:migrate` (or a manual re-apply) produces no error — proving idempotency
(SCENARIO 8). `npx tsc --noEmit` from the repo root is clean after the schema/route/runner changes.
No `infra/index.ts` (Pulumi) change is part of this plan, so no `pulumi preview` diff is expected —
confirmed explicitly here so its absence isn't mistaken for an oversight. Setting the actual
`PROD_EMBEDDING_BACKFILL_SECRET` GitHub secret and running the production backfill are deferred to
`todo.md`'s Manual steps — not performed as part of this unattended planning/build pass.

**Frontend:** N/A — not touched. No UI surface changes; retrieval is invisible to the reader/editor
UI beyond its effect on generated story content, which is not independently verifiable through a
UI assertion (the wishlist's own "Done when" frames success as "sometimes, when thematically
appropriate," not as a UI-observable event).

### Scope boundary

Out of scope for this task:
- Wiring the retrieval tool into the writer stage (see "Decisions made autonomously" — streaming
  UX tradeoff). A clean follow-up, not required to satisfy the wishlist's "Done when."
- Chunked/sub-story retrieval granularity — one embedding per whole story only.
- An ANN index (HNSW/IVFFlat) on `story_embeddings` — sequential scan is sufficient at current and
  near-future corpus size (see "Decisions made autonomously").
- A recurring/scheduled re-embedding job — the approval-time trigger plus the one-off backfill
  cover both "new stories" and "existing stories" without a periodic job.
- Cross-universe retrieval, or any global "search all stories" capability — retrieval is always
  scoped to the current story's own universe, matching every other universe-scoped memory feature
  already in this app (`loadMemorableMoments`, `synthesizeUniverseMemory`).
- Any UI surface showing which past story (if any) was referenced during a given generation — not
  requested by the wishlist's done-when criteria.
- Additional tools beyond `search_past_stories` (e.g. a separate "search by character name" tool)
  — one tool, one clear purpose, per this repo's agentic-development principle against scope creep
  in tool design.
