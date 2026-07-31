---
type: scenarios
branch: story-retrieval
task: Give the plotter/writer real retrieval capability over past stories, not just pre-fetched context (GH #297)
state: confirmed
updated: 2026-07-21
---
# Scenarios: Story retrieval (vector search + tool-calling)

## Business Scenarios

SCENARIO 1: Existing stories become searchable via a one-time backfill

The operator triggers the new internal backfill endpoint once after deploy, and every story with
status `read` gets an embedding stored so retrieval has something to search from day one.

What to verify:
- Every story with `status = 'read'` that has usable text (`textFinal ?? textV2 ?? textV1`) ends up
  with a row in `story_embeddings` after the call completes.
- A story with no usable text is skipped (reported, not silently dropped and not treated as a
  failure).
- The response reports counts (embedded / skipped / failed), not just a bare `{ ok: true }`.

SCENARIO 2: A newly approved story gets embedded automatically

When a story is approved and `analyzeStoryAndLearn` runs (the existing trigger for style-guide
updates and fact extraction), the story's final text is embedded and stored without any manual
step, at the same point those other side effects already run.

What to verify:
- `embedStory` is invoked as part of `analyzeStoryAndLearn`'s existing side-effect fan-out — no
  separate trigger path is introduced.
- A failure embedding the story (e.g. the OpenRouter embeddings call times out) does not fail the
  surrounding analyze-and-learn flow or block the style-guide/fact-extraction updates that already
  run there.
- The stored embedding row records the story's `groupId` as its `universe_id`, so it is
  immediately eligible for that universe's retrieval.

SCENARIO 3: The plotter retrieves a relevant past callback on its own initiative

While planning a new story's outline, the plotter model — without being told which story to
reference — decides to call `search_past_stories` with a thematic query, and the returned past
story content becomes available to it before it finishes the outline.

What to verify:
- The tool is only offered to the plotter when the story has a resolved `universeId` — a
  universe-less story gets no tool at all (mirrors how `loadMemorableMoments` already no-ops on
  `universeId === null`).
- The tool executes server-side against that universe's embeddings only, excluding the current
  story itself from its own candidate results.
- Retrieved content is returned to the model as a `role: 'tool'` message — never concatenated
  into the system or developer prompt — so it is structurally data, not a new instruction, even
  though the corpus itself is trusted (same-author story text, not third-party input).
- Calling the tool is optional: a plotter run that never calls it still completes normally. This
  matches the wishlist's explicit constraint that the model must judge thematic fit itself rather
  than a callback being forced.

SCENARIO 4: Retrieval on a universe with no embedded stories yet returns a clear empty result

The first story ever generated in a brand-new universe (or a universe whose stories haven't been
embedded yet) has the plotter call the tool, and gets a structured "nothing found" response
instead of an error.

What to verify:
- `searchPastStories` returns `{ results: [], note: '...' }` rather than throwing when zero rows
  match for that `universe_id`.
- The plotter completes the outline normally despite the empty retrieval result — an empty result
  is not treated as a failure anywhere in the chain.

SCENARIO 5: Retrieval never leaks across universes

A search issued while planning a story in universe A never returns a story that belongs to
universe B, even if that story is a closer semantic match than anything in universe A.

What to verify:
- The database query filters by `universe_id` before ranking by similarity (a `WHERE` clause, not
  a post-hoc filter on ranked results).
- A direct query against `story_embeddings` for one `universe_id` never returns rows whose
  `universe_id` differs.

## Technical/Architectural Scenarios

SCENARIO 6: The tool-call loop cannot run away

If the model keeps requesting the tool on every turn, the runner stops and forces a final answer
after a fixed number of iterations rather than looping indefinitely or growing cost unbounded.

What to verify:
- A hard iteration cap (`MAX_TOOL_ITERATIONS`) is enforced in code, not left to the prompt or to
  model good behavior.
- After the cap is reached, the runner returns the last available assistant text instead of
  throwing or hanging.
- Every iteration — including each tool-call round trip — is still recorded through the existing
  `costRecorder`, so a multi-iteration generation's full cost is visible in existing dashboards,
  not just the final call's.
- A single tool-loop response containing more tool calls than a small per-iteration cap (e.g. more
  than 3 distinct calls in one turn) still only executes up to that cap, not an unbounded number.

SCENARIO 7: Internal backfill endpoint rejects unauthenticated calls

Something calls `POST /api/internal/embed-story-backfill` without the correct secret header.

What to verify:
- The request is rejected with `401` before any story is touched, matching the existing
  `catalog-sync` / `universe-memory-sync` / `backfill` internal-endpoint pattern (secret header,
  fail closed).

SCENARIO 8: pgvector extension, table, and index exist after migration, and the migration is
idempotent

The migration that introduces vector storage runs cleanly on a fresh database and can be re-run
without error on a database that already has it applied.

What to verify:
- `CREATE EXTENSION IF NOT EXISTS vector` succeeds on Neon (Postgres 17, pgvector available
  natively).
- `story_embeddings` exists with an `embedding` column of type `vector(1536)` afterward.
- Running the migration file's statements a second time against the same database does not error
  (every statement uses `IF NOT EXISTS` / an idempotent-safe form), matching the pattern already
  established in this repo's `0039`–`0043` migrations.

SCENARIO 9: Re-running the backfill is a true no-op for unchanged stories

The operator runs the backfill endpoint a second time with no new stories and no story text
changed since the first run.

What to verify:
- No story whose stored `content_hash` still matches its current text gets re-embedded (no
  redundant OpenRouter embeddings call for it).
- The response reports `embedded: 0` for the unchanged set, distinguishing "nothing new to do"
  from "ran and found nothing."
- If a story's text *did* change since it was last embedded (content hash differs), it is
  re-embedded and its row is updated in place (upsert on `story_id`), not duplicated.

SCENARIO 10: Deleting an embedded story doesn't break story deletion

An operator deletes a story (`DELETE /stories/:id`) that already has a `story_embeddings` row.

What to verify:
- The delete succeeds — it does not fail with a foreign-key constraint violation. This repo's
  schema uses no `onDelete: 'cascade'` on any existing FK (confirmed by reading `schema.ts`);
  every table with a `storyId` FK is deleted explicitly, in order, inside the existing
  `DELETE /stories/:id` handler before the story row itself is deleted. `story_embeddings` follows
  that same established pattern rather than introducing a DB-level cascade inconsistent with every
  other table.
- After the delete, no `story_embeddings` row for that `story_id` remains (no orphaned vector).
