---
type: todo
branch: story-retrieval
task: Upgrade the built story-retrieval RAG pipeline (GH #297) with evidence-based improvements, not generic RAG advice
state: open
updated: 2026-07-22
---
# Todo: Story retrieval RAG upgrade

## Decisions to make

Nothing to decide. Every fork this upgrade touched was resolved with direct evidence gathered
against the real corpus before planning began (see `architecture.md`'s "Investigation summary" and
`spec.md`'s "Decisions made autonomously") — the six RAG techniques evaluated, the choice to edit
migration `0044` in place rather than add a new one, and the eval harness's manual-only trigger all
had safe, evidenced defaults.

## To review / clarify

Nothing to review.

## Manual steps

- No new manual steps beyond what the original `story-retrieval` plan's `todo.md` already
  documents (create `PROD_EMBEDDING_BACKFILL_SECRET`, trigger the one-off backfill after deploy) —
  those are unchanged by this upgrade, they just now produce `bge-m3` vectors instead of
  `text-embedding-3-small` ones.
- After implementation, run `npm run eval:retrieval` locally at least once against a real embedded
  corpus (the disposable verify branch, or local dev DB after a local backfill) to confirm the
  harness itself runs end to end before relying on it for future regression checks.

## Post-deploy checks

- After the production backfill runs (per the original plan's manual step), spot-check
  `SELECT embedding_model, count(*) FROM story_embeddings GROUP BY embedding_model;` shows only
  `baai/bge-m3` rows — no leftover `text-embedding-3-small` rows from an earlier partial run.
</content>
