# Loop State

Loop started: 2026-05-02T01:34:00Z
Stop after: 2026-05-02T06:34:00Z (5 hours)
Cron job ID: ae213e1f — CANCELLED (all tasks complete)

---

## Task Breakdown

### T1: Move catalog sync to GCP Cloud Scheduler + Cloud Tasks
- [x] T1.1 — Research: setInterval in sync-catalog.ts fires on boot + every 24h; fragile on Cloud Run restarts. Cloud Scheduler → direct HTTP call is sufficient (no Cloud Tasks needed — Scheduler has built-in retry).
- [x] T1.2 — Infra: added cloudscheduler.googleapis.com to requiredApis; Cloud Scheduler job `catalog-sync` (0 3 * * * UTC, 3 retries) → POST https://bedtime-agent.ilya.online/api/internal/catalog-sync with X-Catalog-Sync-Secret header. Secret stored as Pulumi secret `catalogSyncSecret`.
- [x] T1.3 — API: added POST /api/internal/catalog-sync (internal-catalog-sync.ts) registered before requireAuth; validates X-Catalog-Sync-Secret header against CATALOG_SYNC_SECRET env var.
- [x] T1.4 — Core: scheduleDailyCatalogSync returns early when CATALOG_SYNC_MODE=gcp; keeps working via setInterval for local dev.
- [ ] T1.5 — Deploy and verify: requires manual steps — see below
**Status: code done, deploy pending**

#### T1.5 manual steps:
1. `pulumi config set --secret catalogSyncSecret <random-value>` in `infra/`
2. Add `PROD_CATALOG_SYNC_SECRET=<same-value>` to GitHub secrets
3. `pulumi up` in `infra/` to create the Cloud Scheduler job
4. Push to main to deploy Cloud Run with new env vars
5. Verify: `gcloud scheduler jobs run catalog-sync --location=us-central1 --project=bedtime-prod`

### T2: Timeline redo
- [x] T2.1 — Audited: toPipelineSteps was phase-scoped (only Writer or Plotter); Questions injected by frontend; no cross-phase visibility
- [x] T2.2 — API now owns step list via buildFullPipelineSteps: Questions (manual only), Plotter, Writer, WriterCritic (if summary exists); all steps with correct status based on pipeline state
- [x] T2.3 — Frontend toPipelineSteps simplified to pure API→PipelineStep mapping; mode awareness moved to API
**Status: DONE**

### T3: Writer completion doesn't update page (Show Text button not auto-enabled)
- [x] T3.1 — Root cause: server calls `res.end()` synchronously after `res.write()` for terminal SSE status — TCP FIN can race the data. Client `onerror` closed connection without re-fetching state.
- [x] T3.2 — Fixed: (a) server now uses `setImmediate(() => res.end())` in pipeline.ts; (b) client `onerror` now calls `fetchStatusRef.current?.()` to recover missed terminal status via HTTP poll.
**Status: DONE**

### T4: SSE chunks appear then disappear under pipeline
- [x] T4.1 — Traced: chunk_reset fires only when fallback model activates (openrouter.runner.ts:124). Client clears streamingText immediately → "thinking" flash.
- [x] T4.2 — Fixed: deferred reset via pendingResetRef. On chunk_reset: mark pending, keep old text visible. On first new chunk: replace text fresh. No more disappear/reappear.
**Status: DONE**

### T5: Remove multiple plotter iterations — run only once
- [x] T5.1 — Find: plotter already runs exactly once per trigger (no loop in orchestrator.ts or plan-trigger). Multiple model_calls entries for plotter = manual redos by user. **No code change needed.**
- [x] T5.2 — N/A
**Status: DONE (already resolved)**

### T6: Rewrite model selector — reuse existing model checkbox (default checked)
- [x] T6.1 — Found: swap-model-modal.tsx, opened from story-reader.tsx "Ещё один проход" button
- [x] T6.2 — Added: checkbox "Использовать ту же модель" (default checked); when unchecked shows model selector; effectiveModel passed to swapModel.submit
**Status: DONE**

---

## Work Log
- 2026-05-02 01:34 — Loop started, all tasks broken down into phases
- 2026-05-02 01:34 — T5 resolved (no-op, plotter already single-run); T6 done (reuse model checkbox added to swap-model-modal.tsx)
- 2026-05-02 01:38 — T3 done (SSE FIN race fixed: setImmediate on server + onerror re-fetch on client)
- 2026-05-02 — T4 done (chunk_reset deferred: text stays visible until first new chunk arrives)
- 2026-05-02 — T2 done (full pipeline step list: Questions+Plotter+Writer+WriterCritic; mode-awareness moved to API)
- 2026-05-02 — T1 code done (Cloud Scheduler job in Pulumi, /api/internal/catalog-sync endpoint, CATALOG_SYNC_MODE=gcp no-op); T1.5 deploy requires manual steps
