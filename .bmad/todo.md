# Human todo (post-run)

Things the loop cannot do itself — for Ilya after the code lands.

- [ ] Review + commit Batch B (create-flow changes: auto-only, global modal, idea diversity) + the 5 new features. Nothing has been committed yet.
- [ ] Fill in the new structured character fields (age/setting/traits/relationships/co-occurrence) for universe 1 (Гоша) — the strict character-bible gate is OPT-IN: it stays completely dormant (existing behavior) until you fill ≥1 structured field on ≥1 character. When you do, include the main cast (Гоша, Мира…) or the gate will exclude anyone not listed.
- [ ] Add a few target words on the new Слова page for universe 1 to see vocabulary weaving in action.
- [ ] Deploy to prod when ready (push to main triggers CI; migration 0038 runs in the deploy job against prod Neon).

## Bug B (Cloud Tasks durable pipeline) — activation steps
The code ships with a local fallback, so nothing changes until these are done:
- [ ] Create GitHub secret `PROD_PIPELINE_WORKER_SECRET` (any random string).
- [ ] `cd infra && pulumi up` — creates the `bedtime-pipeline` Cloud Tasks queue, the enqueuer IAM binding, and enables the Cloud Tasks API.
- [ ] Deploy (push to main / manual dispatch) — sets `PIPELINE_QUEUE`, `PIPELINE_WORKER_URL`, `PIPELINE_WORKER_SECRET` on Cloud Run. Once set, generation goes through the durable queue; until then it uses the old in-process path.
- [ ] After deploy, POST the existing `/api/internal/backfill` once to rescue story 107 (and any other stalled draft).
