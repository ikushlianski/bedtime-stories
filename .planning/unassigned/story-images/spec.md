---
type: spec
branch: story-images
task: Generate story illustrations on approval
complexity: complex
state: confirmed
updated: 2026-07-22
---
# Spec: Story illustration generation

### Implementation Phases

Single phase implementation. The pieces (moment selection, image generation, storage, dispatch wiring, frontend display) are small enough and interdependent enough (each needs the previous to test end-to-end) that splitting into separate delivery phases would only add coordination overhead, not reduce risk.

### Derivers

| Deriver | Inputs | Output | Scenarios covered |
|---|---|---|---|
| `deriveIllustrationPrompt` | scene description, universe `visualStyleGuide` (nullable), characters present with their `visualDescription` (nullable per character) | final prompt string sent to the image model | SCENARIO 3 |
| `deriveImageRetryDecision` | current attempt count, error classification (`retryable` \| `moderation_refused` \| `success`) | `{ shouldRetry: boolean, nextStatus: 'ready'\|'failed'\|'generating', failureReason: string \| null }` | SCENARIO 6, 7, 8 |
| `deriveImageStoragePath` | universeId (nullable), storyId, sequenceIndex | GCS object path string | SCENARIO 5, 10 |
| `deriveReferenceImageUpdate` | universe's current `referenceImagePath` (nullable), a newly-succeeded image's path | `{ shouldUpdate: boolean, newPath: string \| null }` — only ever sets it if currently null | SCENARIO 4 |
| `deriveBackfillCandidates` | list of `ready` story ids, list of story ids that already have `story_images` rows | list of story ids still needing a first generation | SCENARIO 9 |

### Files by scenario

| Scenario | Backend files | Frontend files | Infrastructure files |
|---|---|---|---|
| SCENARIO 1 | `packages/api/src/routes/stories.ts` (approve-text handler — add dispatch call), `packages/api/src/routes/pipeline-dispatch.ts` (new `dispatchImageGeneration`) | None | None |
| SCENARIO 2 | `packages/core/src/pipeline/stages/illustration-moment-selector.ts` (new), `packages/core/src/pipeline/schemas.ts` (new Zod output schema) | None | None |
| SCENARIO 3 | `packages/core/src/pipeline/derivers/illustration-prompt.ts` (new), `packages/core/src/db/schema.ts` (visual style columns) | None | None |
| SCENARIO 4 | `packages/core/src/pipeline/derivers/reference-image-update.ts` (new), `packages/api/src/routes/story-images.ts` (new orchestration) | None | None |
| SCENARIO 5 | `packages/core/src/storage/gcs-images.ts` (new), `packages/api/src/routes/story-images.ts` (new authenticated GET route) | `packages/web/src/pages/story-reader.tsx` (display), `packages/web/src/lib/api.ts` (new client method) | None |
| SCENARIO 6 | `packages/api/src/routes/pipeline-dispatch.ts`, `packages/api/src/routes/internal-worker.ts` (new `/generate-images` route, same catch-and-log shape as `/analyze`) | None | None |
| SCENARIO 7 | `packages/core/src/openrouter/openrouter.client.ts` (new `generateImage()`, refusal classification), `packages/core/src/pipeline/derivers/image-retry-decision.ts` | None | None |
| SCENARIO 8 | `packages/api/src/routes/story-images.ts` (attempt cap enforcement, unique-slot upsert) | None | None |
| SCENARIO 9 | `packages/api/src/routes/internal-backfill-images.ts` (new), `packages/core/src/pipeline/derivers/backfill-candidates.ts` (new) | None | None |
| SCENARIO 10 | `packages/api/src/routes/pipeline-dispatch.ts`, `packages/api/src/routes/internal-worker.ts` | None | None |
| SCENARIO 11 | None | None | `infra/index.ts` (new `gcp.storage.BucketIAMMember`) |

### Files to create

```
packages/core/src/
  pipeline/
    stages/illustration-moment-selector.ts   — structured LLM stage, aiRunner.runStructured, 3-scene output
    derivers/
      illustration-prompt.ts (+ .test.ts)     — combine scene + style guide + character visuals into final prompt
      image-retry-decision.ts (+ .test.ts)    — retry/terminal-state logic per Scenario 7/8
      image-storage-path.ts (+ .test.ts)      — GCS path convention
      reference-image-update.ts (+ .test.ts)  — set-once canonical reference logic
      backfill-candidates.ts (+ .test.ts)     — which ready stories still need illustrations
  storage/
    gcs-images.ts                              — thin @google-cloud/storage wrapper: upload(path, bytes), read(path)
packages/api/src/routes/
  story-images.ts                              — orchestration (generateStoryImages(storyId)) + GET route serving image bytes
  internal-backfill-images.ts                  — one-time backfill endpoint, reuses BACKFILL_SECRET convention
packages/core/src/db/migrations/
  00XX_story_images.sql                        — generated via drizzle-kit generate, never hand-written
```

### Files to modify

```
packages/core/src/db/schema.ts        — add story_images table; add visual_style_guide + reference_image_path to story_groups; add visual_description to universe_characters
packages/core/src/env.ts               — add optional GCS_BUCKET_NAME to the Zod env schema
packages/core/src/openrouter/openrouter.client.ts — add generateImage() hitting POST /api/v1/images (separate from existing chat/completions methods)
packages/core/src/pipeline/schemas.ts  — add IllustrationMomentsOutputSchema
packages/api/src/routes/pipeline-dispatch.ts — add dispatchImageGeneration(storyId), mirroring dispatchAnalysis exactly
packages/api/src/routes/internal-worker.ts   — add POST /generate-images, same secret middleware + catch-and-log shape as /analyze
packages/api/src/routes/stories.ts     — approve-text handler calls dispatchImageGeneration alongside the existing dispatchAnalysis call
packages/api/src/server.ts             — mount story-images router (GET image route) and internal-backfill-images router
packages/web/src/pages/story-reader.tsx — render ready story_images in sequence order
packages/web/src/lib/api.ts            — add api.stories.images(id) client method
infra/index.ts                         — add BucketIAMMember for api-sa scoped to bedtime-prod-storage
package.json (packages/core)           — add @google-cloud/storage dependency
```

### Cost estimate

Verified live pricing (OpenRouter `/api/v1/models` catalog + Google's own `ai.google.dev/gemini-api/docs/pricing`, both checked 2026-07-22): `google/gemini-2.5-flash-image` costs **$0.039 per generated 1024×1024 image** (1290 output tokens × $0.00003/token image-output rate; reference/input image tokens add fractions of a cent, negligible).

- **One-time backfill** of the ~100 existing approved stories, at ~2.5 images/story average: 100 × 2.5 × $0.039 ≈ **$10 total**.
- **Ongoing, per newly-approved story** (2-3 images): **≈ $0.08–0.12/story**.

Fallback models (`black-forest-labs/flux.2-pro` at ~$0.03/first output megapixel, `flux.2-flex` at ~$0.06/MP both directions) are comparable or slightly cheaper per image than the primary model if ever needed — cost is not a reason to prefer one over the other; consistency/reliability is (an empirical, implementation-phase question per the already-resolved provider decision).

### Data model changes

See `architecture.md` → "Data model evolution" for full column-level detail. Summary: new `story_images` table (one row per illustration slot, current-state shape like `story_text_versions`); two new nullable columns on `story_groups` (`visual_style_guide`, `reference_image_path`); one new nullable column on `universe_characters` (`visual_description`). All additive, no existing column changes, no backfill required by the migration itself.

### Documentation changes

New — a short Mermaid diagram of this architecture (the sequence diagram already drafted in `architecture.md`) will be published to `docs/architecture/story-images.md` during implementation. No existing docs currently describe the approval-triggered background dispatch pattern in enough detail to need updating for this addition — `CLAUDE.md`'s "Cloud Infrastructure" section gets one line added noting the bucket is now actively used (no longer "for future use") and listing the new `GCS_BUCKET_NAME` env var alongside the existing required Cloud Run env vars.

### Decisions made autonomously

- **Model slug correction**: use `google/gemini-2.5-flash-image` (GA), not `google/gemini-2.5-flash-image-preview` (retired/promoted) — same model family and image-to-image capability the original decision was based on, just the current live identifier. Verified via OpenRouter's live `/api/v1/models` catalog on 2026-07-22.
- **3 images per story, fixed constant for v1** (not user-configurable) — matches "a couple of pictures" per story loosely while giving a complete opening/climax/resolution arc; easy to change later since it's a single constant, not a schema constraint (the unique `(story_id, sequence_index)` constraint tolerates any small count).
- **Moment selection via a new structured LLM stage, not by parsing `planFinal`** — `planFinal` is free-text beats, not structured data; parsing it with regex/heuristics would be fragile and silently break on prose changes. A cheap dedicated LLM call, following the exact existing `runStoryAnalyzer`/`runUniverseFactExtractor` pattern, is the established, low-risk way this codebase already handles "extract structured facts from free text."
- **One canonical per-universe reference image, not the previous story's image** — chaining image-to-image off the most recently generated image drifts visually over many stories; a single fixed anchor set once (the first success) does not. Reversible later (a future admin "reset the reference image" action is a small, additive change, not a redesign).
- **Images served via an authenticated API proxy route, not GCS signed URLs** — the bucket is already private (`uniformBucketLevelAccess: true`, no `allUsers` grant) and the rest of the app is already behind `requireAuth` with cookie-session auth; a proxy route reuses that existing trust boundary with no new IAM permission (`roles/iam.serviceAccountTokenCreator` would be needed for Cloud Run to self-sign URLs via `signBlob`, which this decision avoids entirely). Slightly more backend bytes-proxying than a signed URL would need, but simpler and more consistent with the existing security model.
- **No new Cloud Tasks queue, no new Cloud Scheduler job** — the existing `bedtime-pipeline` queue's rate limits (3 concurrent, 5 retries) are already tuned for this class of background work and the new task type is small in volume (at most 3 image-generation sub-calls per story); the one-time backfill is manually invoked, not scheduled, since it only ever runs once.
- **Image generation calls do NOT go through `aiRunner`** — `aiRunner.runStructured`/`runText` assume a JSON-or-text response shape from `/chat/completions`; the Image API is a structurally different endpoint (`/api/v1/images`) returning image bytes, so a new, smaller, purpose-built call path is added instead of forcing it into the existing text-shaped interface. It still reuses the exact same `costRecorder`/`model_calls` cost-logging convention as everything else.
- **`model_catalog.image_usd_per_request` is not used for per-image cost anywhere in this feature** — verified (see `architecture.md`) that the existing catalog-sync code populates this column from the wrong upstream pricing field for this model family. Real cost is recorded per-call from the actual API response, same as every other stage. Fixing the catalog-sync mapping itself is out of scope for this plan.
- **Telegram delivery of illustrations is out of scope for v1** — `notifyStoryReady` already pings Telegram on approval; this plan adds no Telegram-specific image delivery. Images are visible on the web story-reader page only.
- **No manual "regenerate this image" UI action in v1** — generation is fully automatic on approval; a parent-triggered regenerate button is a natural, small future addition once the automatic path is proven, not included here to keep the frontend surface area minimal.
- **Image model choice is a hardcoded constant for v1, not swappable via the existing `appSettings.stageModels`/admin model-swap UI** — that system is built for interchangeable text-generation models scored on prose quality; the live pool of GA, image-to-image-capable models on OpenRouter is currently very small (effectively one family), so building admin swappability now would be speculative. Revisit once more image models are viable alternatives.
- **`BACKFILL_SECRET`** (existing env var, already used by `internal-backfill.ts`) is reused for `internal-backfill-images.ts` rather than minting a new secret — same trust boundary (internal admin-triggered backfill), no reason to fragment secrets for the same class of operation.

### Implementation order

0. Request a fresh disposable Neon branch for implementation-phase DB work — this plan's own worktree branch expires imminently and must not be reused for building or verifying against.
1. `/tdd deriveIllustrationPrompt` — covers SCENARIO 3
2. `/tdd deriveImageRetryDecision` — covers SCENARIO 6, 7, 8
3. `/tdd deriveImageStoragePath` — covers SCENARIO 5, 10
4. `/tdd deriveReferenceImageUpdate` — covers SCENARIO 4
5. `/tdd deriveBackfillCandidates` — covers SCENARIO 9
6. Confirm live `/api/v1/images` request/response schema and refusal-classification shape (todo.md item 1) — before step 7
7. `openrouter.client.ts` → `generateImage()`; `illustration-moment-selector.ts` stage + schema
8. `gcs-images.ts` storage wrapper; migration for `story_images` + new columns (generate via drizzle-kit, run via `npm run db:migrate`)
9. `story-images.ts` orchestration (`generateStoryImages`) wiring derivers + stage + client + storage together; `pipeline-dispatch.ts`/`internal-worker.ts` wiring
10. `stories.ts` approve-text handler wiring; `internal-backfill-images.ts`
11. Frontend: `story-reader.tsx` display, `api.ts` client method
12. Infra: `infra/index.ts` IAM binding, `GCS_BUCKET_NAME` env var wiring in deploy step
13. `docs/architecture/story-images.md` diagram publish

### Scope boundary

**In scope**: automatic generation of up to 3 illustrations per story on approval, per-universe visual style consistency via a text style guide + one canonical reference image, private GCS storage served through an authenticated route, web story-reader display, bounded retries and cost, a one-time manual backfill for existing approved stories.

**Explicitly out of scope for v1**: Telegram image delivery; a parent-facing manual regenerate/reject-and-retry UI action; admin UI for swapping the image model or resetting a universe's reference image; per-story configurable image count; live push updates when an image finishes generating after the reader page loaded (a refresh picks it up); fixing the pre-existing `model_catalog.image_usd_per_request` catalog-sync mapping bug.

---

### Definition of Done — per layer

**Backend**: A real story is approved end-to-end (`POST /stories/:id/approve-text` with `approved: true`) against a live database and a live OpenRouter API key. Within a bounded wait, exactly up to 3 rows exist in `story_images` for that `story_id`, each with a real `model_id`, a real `prompt_used`, and either `status = 'ready'` with a non-null `gcs_path`, or `status = 'failed'` with a populated `failure_reason` — verified by directly querying the database, not by reading application logs or trusting a 200 response from the approval endpoint. At least one row must reach `status = 'ready'` for the check to count as passing (an all-failed run is not proof the feature works). A corresponding `model_calls` row exists for at least one image-generation attempt with a nonzero `usd_micros`.

**Infrastructure**: The `bedtime-prod-storage` GCS bucket actually contains the object at the `gcs_path` recorded in a `ready` `story_images` row — verified by fetching that exact object directly via the GCS API/console (or `gsutil`/`gcloud storage cat`) using the deployed environment's credentials, confirming it is a real, non-empty, valid image file (openable, correct content type) — not just that the upload call returned success. The `api-sa` service account's new IAM binding is confirmed scoped to this one bucket only (no project-wide `storage.admin` grant introduced), verified by reading the applied Pulumi state/IAM policy, not just the source file.

**Frontend**: Loading the story-reader page for the story used in the Backend check above, in a real browser session (authenticated), actually renders the generated image(s) — the image `<img>` element resolves and paints a real picture, not a broken-image icon — verified by an actual screenshot or visual inspection during manual verification, not by asserting the API response shape alone. A second story with zero `ready` `story_images` rows (either still generating or all failed) renders the reader page with no image section and no visible error, confirmed the same way.
