---
type: spec
branch: story-retrieval
task: Upgrade the built story-retrieval RAG pipeline (GH #297) with evidence-based improvements, not generic RAG advice
complexity: complex
state: confirmed
updated: 2026-07-22
---
# Spec: Story retrieval RAG upgrade

### Why

The original #297 build (`.planning/unassigned/story-retrieval/`) gave the plotter a real,
model-initiated retrieval tool over past stories. This upgrade reviews that build against real RAG
best practices, evaluated against this app's actual data and code rather than generic advice, and
changes exactly what the evidence supports changing: the embedding model. Five other standard RAG
techniques (chunking, re-ranking, hybrid search, multi-query expansion, and — as a genuinely new
addition — a retrieval-quality evaluation harness) were investigated with real queries against the
real corpus; four of those five are confirmed as no-change, one (the eval harness) is added. See
`architecture.md`'s "Investigation summary" for the full evidence behind each conclusion.

### Implementation Phases

Single phase. The model/dimension swap and the new eval harness are independent of each other but
small enough, and touch few enough files, that splitting them into separate phases would only add
process overhead without any real sequencing dependency to justify it.

### Derivers

| Deriver | Inputs | Output | Scenarios covered |
|---------|--------|--------|--------------------|
| `deriveRecallAtK` (new, `pipeline/eval-recall.ts`) | `rankedIds: number[]` (a query's results, ranked by similarity), `expectedIds: number[]` (curated acceptable story IDs for that query), `k: number` (how many top results to check) | `number` — the fraction of `expectedIds` present within `rankedIds.slice(0, k)`, in `[0, 1]` | SCENARIO 2 |

No other pure-computation change: the model/dimension swap is a constant-value change in
`embed-story.ts`/`schema.ts`, not new logic, and the existing dimension-mismatch check in
`embedStoriesBatch` is exercised against the new constant unchanged (SCENARIO 4).

### Files by scenario

| Scenario | Backend files | Frontend files | Infrastructure files |
|----------|---------------|-----------------|------------------------|
| SCENARIO 1 — better retrieval via model swap | `packages/core/src/pipeline/embed-story.ts`, `packages/core/src/db/schema.ts` | None | `packages/core/src/db/migrations/0044_story_embeddings.sql`, `packages/core/src/db/migrations/meta/0044_snapshot.json` |
| SCENARIO 2 — on-demand retrieval-quality check | `packages/core/src/pipeline/eval-recall.ts`, `packages/core/src/scripts/eval-search-past-stories.ts` | None | `package.json` (new `eval:retrieval` script) |
| SCENARIO 3 — vector dimension + migration idempotency | None | None | `packages/core/src/db/migrations/0044_story_embeddings.sql`, `packages/core/src/db/schema.ts` |
| SCENARIO 4 — dimension-mismatch safety net still works | `packages/core/src/pipeline/embed-story.ts`, `packages/core/src/pipeline/embed-story.test.ts` | None | None |

### Files to create

```
packages/core/src/pipeline/
  eval-recall.ts                    — deriveRecallAtK (pure function, see Derivers)
  eval-recall.test.ts

packages/core/src/scripts/
  eval-search-past-stories.ts       — manual, developer-triggered script: a fixed set of ~8-10 real
                                       Russian test queries against the universe-1 corpus, each with
                                       a curated expected story ID (or small acceptable set); embeds
                                       each query with the current EMBEDDING_MODEL, ranks the real
                                       corpus via the same pgvector cosine-distance query
                                       searchPastStories already uses, computes recall via
                                       deriveRecallAtK, and prints a human-readable pass/fail report
                                       per query plus an overall summary. Follows the existing
                                       `packages/core/src/scripts/` convention (notion-import.ts,
                                       create-user.ts) — a plain script run via tsx, not an HTTP
                                       route, not part of any test runner.
```

### Files to modify

```
packages/core/src/pipeline/embed-story.ts
  EMBEDDING_MODEL: 'openai/text-embedding-3-small' -> 'baai/bge-m3'
  EMBEDDING_DIMENSIONS: 1536 -> 1024
  No other logic changes — embedStoriesBatch's existing dimension-mismatch check
  (`vector.length !== EMBEDDING_DIMENSIONS`) now guards 1024 automatically, since it already reads
  the constant rather than a hardcoded literal.

packages/core/src/pipeline/embed-story.test.ts
  Add a case asserting the dimension-mismatch check still throws/reports-as-failed when a
  simulated embeddings response returns a vector of the wrong length relative to the (now 1024)
  EMBEDDING_DIMENSIONS constant — proves the safety net moved with the constant, not left pinned
  to the old value (SCENARIO 4).

packages/core/src/db/schema.ts
  storyEmbeddings.embedding: vector('embedding', { dimensions: 1536 }) -> { dimensions: 1024 }
  storyEmbeddings.embeddingModel: default('openai/text-embedding-3-small') -> default('baai/bge-m3')

packages/core/src/db/migrations/0044_story_embeddings.sql
  "embedding" vector(1536) NOT NULL -> vector(1024) NOT NULL
  "embedding_model" text DEFAULT 'openai/text-embedding-3-small' NOT NULL -> DEFAULT 'baai/bge-m3'
  Edited in place, not superseded by a new migration — see "Decisions made autonomously" for why
  this is safe here specifically.

packages/core/src/db/migrations/meta/0044_snapshot.json
  Update the "embedding" column's recorded "type": "vector(1536)" -> "vector(1024)" and
  "embedding_model"'s recorded "default" to match, so drizzle-kit's own snapshot state stays
  consistent with the hand-edited migration file and a future `drizzle-kit generate` doesn't
  produce a spurious diff against the actual schema.

package.json
  + "eval:retrieval": "tsx packages/core/src/scripts/eval-search-past-stories.ts" — alongside the
    existing "notion-import"/"create-user" script entries.

docs/architecture/story-retrieval.md
  Update every mention of "openai/text-embedding-3-small" / "1536" to "baai/bge-m3" / "1024".
  Add a short "Retrieval quality" section describing the new eval harness and how to run it.
  Add a brief "Investigated, not changed" note listing the four RAG techniques evaluated and
  rejected (chunking, re-ranking, hybrid search, multi-query expansion), each with a one-line
  reason, pointing back to this plan's architecture.md for the full evidence.

docs/architecture/diagrams/07-story-retrieval.mmd
  Update the "OpenRouter /embeddings<br/>openai/text-embedding-3-small" label to
  "OpenRouter /embeddings<br/>baai/bge-m3".

docs/architecture/img/07-story-retrieval.png
  Re-rendered from the updated .mmd via the existing mermaid-cli command already documented in
  docs/architecture/README.md.
```

### Data model changes

`story_embeddings.embedding` changes from `vector(1536)` to `vector(1024)`; `embedding_model`'s
column default changes to `'baai/bge-m3'`. See `architecture.md`'s "Data model evolution" for the
full reasoning on why this is an in-place edit to the existing unreleased migration rather than a
new one. No changes to `stories`, `story_groups`, or `universe_characters`.

### Documentation changes

- `docs/architecture/story-retrieval.md` — existing doc found and updated in place (model/dimension
  references, new "Retrieval quality" section, "Investigated, not changed" summary) — this is the
  doc `architecture.md`'s Mermaid diagram and prose already live in from the original build.
- `docs/architecture/diagrams/07-story-retrieval.mmd` and `docs/architecture/img/07-story-retrieval.png`
  — updated and re-rendered to match, per this repo's existing convention of keeping the `.mmd`
  source and rendered `.png` in sync with the prose doc.
- No change to `docs/architecture/README.md`'s table — the doc it points to already exists; only
  its content changes, not its existence or listing.

### Decisions made autonomously

- **Embedding model changed from `openai/text-embedding-3-small` to `baai/bge-m3` without asking
  first.** Reason: cheaper ($0.01/M vs $0.02/M input tokens on OpenRouter), genuinely
  multilingual-tuned (unlike the English-optimized original), directly A/B tested against the real
  corpus with concrete wins on real queries (see `architecture.md`, item 6), and the migration cost
  of switching is effectively zero right now since production has never run the backfill. This is a
  safe, evidenced default per the reversible/low-risk bar — flagged clearly here so it can be
  vetoed after the fact if there's a reason (e.g. operational trust in OpenAI's first-party API
  over an open-weight model proxied through OpenRouter) to prefer the original model.
- **Migration `0044_story_embeddings.sql` is edited in place, not superseded by a new migration
  file.** Reason: this repo's normal practice (confirmed by reading `schema.ts` and the migrations
  folder) is to always generate a new migration for schema changes — but that practice exists to
  protect databases that already have the previous migration applied. `0044` has never been applied
  to production or any shared environment; it exists only on this unmerged branch and on disposable
  verify branches used solely for this planning session. Editing it in place avoids two migrations
  doing the work of one for a feature that has never shipped, while still following the normal
  new-migration practice for every other, already-shipped schema change in this repo.
- **The retrieval-quality eval harness is a manual script, not a CI-gated test.** Reason: CI's
  `test` job has no `DATABASE_URL` or `OPENROUTER_API_KEY` (only the `deploy` step receives
  secrets); adding either to support one eval script is a real secret-exposure and cost/flakiness
  increase this task doesn't need. This mirrors the existing precedent of `internal-backfill.ts`
  being a manually-triggered one-off, not a scheduled or CI-gated job.
- **The eval harness is scoped to universe 1 only (the ~60-100-story corpus), not universes 3 and
  5 (3-4 stories each).** Reason: a meaningful recall check needs enough candidate stories to
  distinguish "found the right one" from "trivially found the only one" — universes with 3-4
  stories don't have enough volume for the check to be informative. Easy to extend if a smaller
  universe grows large enough to be worth testing.
- **Chunking, re-ranking, hybrid search, and multi-query expansion are investigated and explicitly
  not changed** — each backed by a direct test against the real corpus, not a generic RAG-advice
  default. See `architecture.md`'s "Investigation summary", items 1, 2, 3, and 5.
- **The hybrid-search conclusion (item 3) required correcting an initial wrong hypothesis** — a
  narrow top-10 test first suggested a real precision gap for character-name queries; a
  larger-sample top-15 test on the same query showed no such gap. Documented explicitly, including
  the self-correction, so a future reader doesn't redo this investigation from the stale first
  impression.

### Implementation order

1. `packages/core/src/pipeline/embed-story.ts` — swap `EMBEDDING_MODEL`/`EMBEDDING_DIMENSIONS` —
   covers SCENARIO 1, 4 (foundational; every downstream file reads these constants).
2. `packages/core/src/db/schema.ts` + `0044_story_embeddings.sql` + `0044_snapshot.json` — dimension
   and default-model changes — covers SCENARIO 1, 3.
3. Run `npm run db:migrate` against the disposable verify branch to confirm the edited migration
   applies cleanly and idempotently — covers SCENARIO 3.
4. `/tdd deriveRecallAtK` (`eval-recall.ts` + `eval-recall.test.ts`) — covers SCENARIO 2.
5. `packages/core/src/pipeline/embed-story.test.ts` — add the dimension-mismatch-still-works case —
   covers SCENARIO 4.
6. `packages/core/src/scripts/eval-search-past-stories.ts` + `package.json`'s `eval:retrieval`
   script — covers SCENARIO 2.
7. Re-embed the disposable verify branch's corpus with the new model (re-run the backfill path) and
   run `npm run eval:retrieval` against it to get a real pass/fail readout — proof for Definition of
   Done, not a separate scenario.
8. Docs: `docs/architecture/story-retrieval.md` + `.mmd`/`.png` diagram update.

### Definition of Done — per layer

**Backend:**
`npx vitest run packages/core/src/pipeline/eval-recall.test.ts packages/core/src/pipeline/embed-story.test.ts packages/core/src/pipeline/search-past-stories-tool.test.ts` passes, covering: (a)
`deriveRecallAtK` returns `1` when the sole expected ID is within the top-`k` slice, a fractional
value when only some of several acceptable IDs are within top-`k`, and `0` when none are
(SCENARIO 2); (b) the dimension-mismatch check in `embedStoriesBatch` still throws/reports-failed
against a simulated wrong-length vector, now measured against the 1024-dim constant (SCENARIO 4);
(c) `deriveSearchPastStoriesArgs`/`deriveSearchPastStoriesResult` (unchanged, already covered by the
original plan) still pass, proving the model swap didn't disturb unrelated logic. Additionally,
after re-running the migration and the backfill against the disposable verify branch
(`square-sound-17808622` / `br-autumn-wind-aksp38a6`) with the new model: a direct
`mcp__Neon__run_sql` query —
`SELECT s.id, s.title, (se.embedding <=> (SELECT embedding FROM story_embeddings WHERE story_id = 108)::vector) AS distance FROM story_embeddings se JOIN stories s ON s.id = se.story_id WHERE se.universe_id = 1 ORDER BY distance LIMIT 5;`
— run with a query embedding for a "scared of the dark" theme (computed via the same `embed()`
call `searchPastStories` uses) returns story 108 ("Тайна свечи и песенки") at or near rank 1,
demonstrating the same real improvement already observed during planning, reproduced after the
schema/constant changes actually land in code (not just in an ad hoc planning script).
`npm run eval:retrieval` runs to completion and reports at least 80% overall recall across the
curated query set (a number chosen to allow 1-2 genuinely ambiguous queries to miss without failing
the whole check, while still catching a real regression).

**Infrastructure:**
`SELECT column_name, udt_name FROM information_schema.columns WHERE table_name = 'story_embeddings' AND column_name = 'embedding';` against the verify branch shows the column exists and accepts
1024-dimensional vectors after `npm run db:migrate` (an insert of a 1536-length vector fails; a
1024-length vector succeeds). Re-running the migration's statements a second time produces no
error (idempotency, matching SCENARIO 3). `npx tsc --noEmit` from the repo root is clean after all
changes. No `infra/index.ts` (Pulumi) change is part of this plan — confirmed explicitly so its
absence isn't mistaken for an oversight.

**Frontend:** N/A — not touched, same reasoning as the original plan: retrieval quality has no
independently UI-observable surface.

### Scope boundary

Out of scope for this upgrade:
- Chunked/sub-story retrieval granularity — investigated, not warranted (architecture.md item 1).
- A reranking pass over retrieved candidates — investigated, not warranted (item 2).
- Hybrid keyword/character-name search alongside vector search — investigated, not warranted,
  including a corrected initial hypothesis (item 3).
- Multi-query/query-expansion inside the tool — investigated, not warranted (item 5).
- Wiring the eval harness into CI — deliberately manual only, see "Decisions made autonomously".
- Any change to the tool's contract, the plotter's wiring, the tool-calling loop, the ANN-index
  decision, or the backfill's manual-trigger design — all confirmed correct by the original
  #297 build and unchanged here.
- Extending the eval harness to universes 3 and 5 — too little data to be informative today.
</content>
