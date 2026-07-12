# Human todo (post-run)

Things the loop cannot do itself — for Ilya after the code lands.

- [ ] Review + commit Batch B (create-flow changes: auto-only, global modal, idea diversity) + the 5 new features. Nothing has been committed yet.
- [ ] Fill in the new structured character fields (age/setting/traits/relationships/co-occurrence) for universe 1 (Гоша) — the strict character-bible gate is OPT-IN: it stays completely dormant (existing behavior) until you fill ≥1 structured field on ≥1 character. When you do, include the main cast (Гоша, Мира…) or the gate will exclude anyone not listed.
- [ ] Add a few target words on the new Слова page for universe 1 to see vocabulary weaving in action.
- [ ] Deploy to prod when ready (push to main triggers CI; migration 0038 runs in the deploy job against prod Neon).

## Bug B (Cloud Tasks durable pipeline) — activation
The deploy workflow provisions everything in one run (infra job runs `pulumi up` → creates the queue + IAM; deploy job sets the env vars). Status:
- [x] GitHub secret `PROD_PIPELINE_WORKER_SECRET` created.
- [x] Deploy dispatched on the feature branch (runs pulumi up + migration 0038 + Cloud Run).
- [ ] After deploy succeeds: verify one real generation completes via the queue (post-deploy canary), then POST `/api/internal/backfill` once to rescue story 107 and any other stalled draft.
- [ ] Merge `feature/story-pipeline-improvements` into main when happy (prod is deployed from the branch right now; main is behind).
