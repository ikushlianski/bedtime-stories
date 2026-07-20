---
type: todo
branch: story-retrieval
task: Give the plotter/writer real retrieval capability over past stories, not just pre-fetched context (GH #297)
state: open
updated: 2026-07-21
---
# Todo: Story retrieval (vector search + tool-calling)

## Decisions to make

Nothing to decide. Every fork surfaced during planning had a safe, reversible default consistent
with the existing stack and patterns (see `spec.md`'s "Decisions made autonomously"); the five
constraints fixed before planning began (vector search, OpenRouter embeddings, pgvector, new
runner tool-calling infra, backfill scope) covered the architectural core, and grill-me surfaced no
fork without a safe default.

## To review / clarify

Nothing to review.

## Manual steps

- Create the GitHub secret `PROD_EMBEDDING_BACKFILL_SECRET` (e.g. `gh secret set
  PROD_EMBEDDING_BACKFILL_SECRET -R ikushlianski/bedtime-stories`) before the deploy that adds the
  `.github/workflows/deploy.yml` env var wiring — the deploy step reads it via
  `${{ secrets.PROD_EMBEDDING_BACKFILL_SECRET }}` and will otherwise pass an empty string as the
  Cloud Run env var.
- After that deploy ships, trigger the one-off backfill once:
  `curl -X POST https://bedtime-agent.ilya.online/api/internal/embed-story-backfill -H "X-Embedding-Backfill-Secret: <the secret>"`
  — embeds the 67 existing `read` stories. Safe to re-run (SCENARIO 9); no scheduled job runs this
  automatically.
- No local Docker dev secret is required to develop this feature end-to-end locally: set
  `EMBEDDING_BACKFILL_SECRET` in the local `.env`/docker-compose env to any local value to exercise
  the backfill route against the dev database.

## Post-deploy checks

- Confirm `SELECT count(*) FROM story_embeddings;` on prod Neon returns 67 (or the then-current
  count of `read` stories) after the manual backfill call above.
- Watch Langfuse for a plotter generation whose trace shows a `search_past_stories` tool call and
  confirm token/cost usage for that generation is still being recorded per iteration, not just for
  the final call.
