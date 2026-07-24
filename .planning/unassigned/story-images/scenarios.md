---
type: scenarios
branch: story-images
task: Generate story illustrations on approval
state: confirmed
updated: 2026-07-22
---
# Scenarios: Story illustration generation

## Business Scenarios

SCENARIO 1: Story approval triggers illustration generation

A parent approves a story's text (`POST /stories/:id/approve-text` with `approved: true`). The story is marked `ready` exactly as it is today, and — independently, without delaying the API response — illustration generation starts in the background for that story.

What to verify:
- The approve-text response time and shape are unchanged; illustration generation never appears in that request/response cycle.
- Illustration generation is dispatched the same way `dispatchAnalysis` is: via the Cloud Tasks queue when `PIPELINE_QUEUE` is configured, falling back to firing in-process otherwise.
- A story with `groupId` null (no universe) still gets illustrations — visual style guide and reference image are optional inputs, not required ones.

SCENARIO 2: Illustration moments are selected from the approved text

A lightweight, structured LLM stage reads the story's `textFinal` and picks 3 scenes to illustrate — by default the opening, the climax, and the resolution — each with a scene description, which characters are present, and a ready-to-use image prompt.

What to verify:
- Exactly 3 scenes are requested per story (constant, not configurable per-request for v1).
- The stage's model/prompt/cost is logged the same way every other structured stage logs it (via `aiRunner.runStructured` → `costRecorder` → `model_calls`), so it shows up in existing cost dashboards with no new reporting code.
- If the story is too short to yield 3 distinct scenes, the stage may return fewer — 1-2 is an accepted degraded result, not a failure.

SCENARIO 3: Image generation uses the universe's visual style and canonical reference

For a universe that already has a saved `visualStyleGuide` and a canonical reference image, each of the 3 image prompts is generated using OpenRouter's Unified Image API with the style guide text folded into the prompt and the canonical reference image passed as image-to-image input.

What to verify:
- The same reference image (not the previous story's freshly-generated image) is reused for every generation in that universe — this is what prevents visual drift over many stories.
- Per-character visual descriptions (from `universeCharacters`) for the characters present in a given scene are included in that scene's prompt.
- Generated images are visibly recognizable as the same characters/style as prior illustrations in that universe — this is a subjective check to be confirmed by the developer looking at real output during implementation, not something scenarios.md can assert mechanically.

SCENARIO 4: First illustration ever generated for a universe (no reference image yet)

A universe has a `visualStyleGuide` (or none yet) but no canonical reference image saved. Illustration generation proceeds text-only (prompt + style guide, no image-to-image input) for this run. If the first image succeeds, it is saved as that universe's canonical reference image for every future generation.

What to verify:
- Generation is never blocked or skipped just because no reference image exists yet.
- The reference image is set at most once per universe — a later manual/admin change to the reference image is a possible future feature, explicitly out of scope for v1.

SCENARIO 5: Generated images are stored and shown to the reader

Once an image finishes generating, its bytes are uploaded to the existing GCS bucket (`bedtime-prod-storage`) and its row is marked ready with the resulting path. The story-reader page fetches and displays all ready images for that story, in scene order, alongside the text.

What to verify:
- Images are served through an authenticated API route (the bucket stays private — no public GCS ACL is introduced).
- A story with zero ready images (still generating, or none succeeded) renders the reader page normally, with no image section, no error shown to the reader.
- Images that finish generating after the reader page was first loaded appear on a subsequent visit/refresh — no requirement for live push updates in v1.

SCENARIO 6: Image generation failure never blocks story approval or reading

The image model call fails (network error, timeout, malformed response) for one or more scenes. The story stays `ready`, is fully readable, and only the failed scene's row is marked `failed` with a reason.

What to verify:
- The failure is caught and logged at the same isolation boundary `analyzeStoryAndLearn`'s callers already use (`.catch(err => console.error(...))`), never propagated to the approve-text request.
- One scene failing does not prevent the other 2 scenes for the same story from generating and succeeding independently.

SCENARIO 7: Content moderation refusal is a normal terminal state, not a crash

The image model refuses to generate an image for a scene (moderation trigger, common for children's-content prompts touching e.g. conflict or fear beats). This is treated identically to any other generation failure: the row is marked `failed` with `failureReason: 'moderation_refused'`, no retry storm, no alert-worthy exception.

What to verify:
- A moderation refusal response from OpenRouter is distinguished (by response shape/status, confirmed against the live API during implementation) from a transient/retryable error, and is NOT retried — retrying a refusal wastes money for a result that won't change.
- Transient errors (5xx, timeout) ARE retried up to the per-scene attempt cap below.

SCENARIO 8: Runaway generation cost is bounded

Each illustration row has an application-level attempt cap independent of the Cloud Tasks queue's own transport-level retry count (which is 5, for delivery failures, not generation failures).

What to verify:
- A single scene retries at most 2 times (3 total attempts) before settling permanently into `failed` — no unbounded retry loop regardless of how many times the background job itself gets retried by the queue.
- A story never generates more than 3 images total, even if the moment-selector stage is re-run for any reason (e.g. a bug causes the worker to be invoked twice) — the unique `(storyId, sequenceIndex)` slot is claimed idempotently, so a re-run updates existing rows rather than creating duplicates.

SCENARIO 9: One-time backfill for existing approved stories

An internal, secret-protected admin endpoint (following the existing `internal-backfill.ts` / `internal-worker.ts` convention) can be invoked to generate illustrations for stories that are already `ready` from before this feature existed.

What to verify:
- The backfill iterates stories in small batches (not all ~100 at once), respecting the same Cloud Tasks queue rate limits already configured (`maxConcurrentDispatches: 3`) so it doesn't spike cost or load in one burst.
- Stories that already have illustration rows are skipped, so the backfill is safe to re-run without duplicating cost.

## Technical/Architectural Scenarios

SCENARIO 10: Illustration generation dispatch mirrors the existing analysis dispatch exactly

A new `dispatchImageGeneration(storyId)` function in `pipeline-dispatch.ts` and a new `/api/internal/worker/generate-images` route in `internal-worker.ts` are added, structurally identical to `dispatchAnalysis`/`/analyze` (same secret-header middleware, same Cloud-Tasks-else-in-process fallback, same one-task-per-story shape).

What to verify:
- The new worker route sits behind the exact same `x-pipeline-secret` header check already applied to `/pipeline` and `/analyze`.
- No new queue is provisioned — the existing `bedtime-pipeline` Cloud Tasks queue is reused for this new task type, since its rate limits and retry config are already tuned for this class of background work.

SCENARIO 11: Cloud Run's API service account gains scoped GCS write access

The `bedtime-prod-storage` bucket currently has no IAM binding for the API's runtime service account (`api-sa`) — only the CI service account has `roles/storage.admin` for deploy-time purposes. A new, narrower IAM binding is added in Pulumi granting `api-sa` write/read access scoped to this one bucket.

What to verify:
- The new binding is bucket-scoped (e.g. `gcp.storage.BucketIAMMember`), not project-wide `roles/storage.admin` — the API should be able to read/write objects in this one bucket, nothing more.
- The bucket itself remains `uniformBucketLevelAccess: true` with no `allUsers`/`allAuthenticatedUsers` grant — this scenario adds a service-account-scoped binding only.
