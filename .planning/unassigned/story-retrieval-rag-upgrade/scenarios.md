---
type: scenarios
branch: story-retrieval
task: Upgrade the built story-retrieval RAG pipeline (GH #297) with evidence-based improvements, not generic RAG advice
state: confirmed
updated: 2026-07-22
---
# Scenarios: Story retrieval RAG upgrade

## Business Scenarios

SCENARIO 1: The plotter's retrieval tool finds better callbacks because the embedding model actually
understands Russian

Today `search_past_stories` embeds every story and every query with `openai/text-embedding-3-small`,
a model with no particular multilingual tuning. Direct A/B testing against the real corpus (see
`architecture.md`) showed this model missing a story that's a much better semantic match than
whatever it did surface, and undervaluing a story that literally opens with the exact theme being
searched for. Switching to a multilingual-tuned model measurably improves which past callback the
plotter can find, at lower cost per embedding, not higher.

What to verify:
- Every new embedding — from the one-off backfill and from the auto-embed-on-approval trigger —
  is computed with the new model and stored at its native output dimension.
- A direct query against the corpus (a story known to literally open with a "lights go out, child
  is scared" beat) ranks that story at or near the top for a thematically matching query — proof
  the swap isn't just cheaper, it's better on this app's actual data.
- No plotter-facing behavior changes: the tool's name, description, and argument shape are
  identical: this is a backend swap of what powers the tool, not a change to the tool's contract.

SCENARIO 2: A developer can check whether retrieval quality regressed, on demand, without waiting
for CI or touching production

Before this upgrade there was no repeatable way to know if a change to the embedding model, the
tool's prompt, or the rendering of retrieved results made retrieval better or worse — only a
one-off manual proof from the original build (a story matching itself at distance zero). Now a
developer can run one command against the real corpus and get a pass/fail readout per test query.

What to verify:
- A fixed set of real Russian test queries, each with a manually-curated expected story (or small
  set of acceptable stories), runs against the live embedded corpus and reports recall per query
  and overall.
- The check is manually triggered (a package.json script), never part of the CI `npm test` gate —
  CI has no `DATABASE_URL` or `OPENROUTER_API_KEY` available to it today, and this repo's existing
  precedent for one-off, credential-requiring checks (`internal-backfill.ts`) is a manually-run
  tool, not a CI step.
- The script's report is human-readable (which queries passed/failed and what was actually
  returned), not just a bare exit code — a failed check should tell a developer what regressed.

## Technical/Architectural Scenarios

SCENARIO 3: The vector column's dimension matches the new model's real output size, and the
migration stays idempotent

`baai/bge-m3` returns 1024-dimensional vectors, not the 1536 the original migration declared for
`text-embedding-3-small`. Since this feature has never been backfilled or deployed to production
(the original migration only exists on this unmerged branch, and production's `story_embeddings`
table doesn't exist yet), this is edited in place rather than layered under a second migration.

What to verify:
- After migration, `story_embeddings.embedding` is `vector(1024)`, not `vector(1536)`.
- Running the migration's statements a second time against the same database produces no error
  (same idempotency pattern as every other migration in `0036`-`0044`).
- `story_embeddings.embedding_model`'s column default reflects the new model, so any row inserted
  without an explicit model value is still attributable.

SCENARIO 4: The dimension-mismatch safety check still works after the swap

`embedStoriesBatch` already throws if an embeddings API response's vector length doesn't match the
expected dimension — this existed specifically to catch exactly this kind of mismatch loudly
instead of silently corrupting stored vectors. The swap must not accidentally disable or bypass
that check.

What to verify:
- The check compares against the (now 1024) `EMBEDDING_DIMENSIONS` constant, not a hardcoded 1536
  left over from the previous model.
- A simulated mismatched-length response (e.g. in a unit test) still throws and is reported in the
  batch's `failed` list, not silently stored.
</content>
