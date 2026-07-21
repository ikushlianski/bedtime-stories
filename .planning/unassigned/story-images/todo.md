---
type: todo
branch: story-images
task: Generate story illustrations on approval
state: open
updated: 2026-07-22
---
# Todo: Story illustration generation

## Decisions to make
Nothing to decide.

## To review / clarify
- **Confirm the exact `/api/v1/images` request/response schema against the live OpenRouter API before writing `generateImage()`.** Planning confirmed the supported parameters (`model`, `prompt`, `resolution`/`aspect_ratio`, reference images via `provider.options`, capability discovery via `GET /api/v1/images/models`) and the pricing, but not exact field names (e.g. whether the image comes back as `b64_json` vs a `url`, the exact reference-image parameter name and its shape for multi-image input). Do this as the literal first implementation step, before `openrouter.client.ts`'s `generateImage()` method is written.
- **Confirm how a content-moderation refusal is distinguished from a generic API error in the live response** (status code, error body shape, or a specific field) — this classification is what Scenario 7 depends on to avoid retrying refusals. Confirm this against the live API in the same pass as the schema check above.
- **Confirm `black-forest-labs/flux.2-pro`/`flux.2-flex` are actually reachable on this OpenRouter account** before wiring them as a fallback — both were priced and documented on public model pages during planning, but neither appeared in the anonymous `/api/v1/models` listing (possibly account/tier-gated visibility). If unreachable, ship v1 with `google/gemini-2.5-flash-image` only and no fallback model, rather than blocking on Flux access.

## Manual steps
- ~~Request a fresh disposable Neon branch~~ — not needed; the existing `story-images-verify` branch (`br-young-cake-akw22mom`) had enough time left and was used directly for implementation and verification.
- No new secret is required for the image API call itself (reuses `OPENROUTER_API_KEY`).
- `GCS_BUCKET_NAME=bedtime-prod-storage` is already wired into the GitHub Actions deploy step (`.github/workflows/deploy.yml`), hardcoded the same way `PIPELINE_QUEUE` is (the bucket name is a fixed literal in `infra/index.ts`, not dynamically read from a Pulumi output at deploy time).
- **`pulumi up` has NOT been run.** The new `gcp.storage.BucketIAMMember` (`api-storage-object-admin`, `roles/storage.objectAdmin` scoped to `bedtime-prod-storage` only, granted to the existing `api-sa`) exists only in `infra/index.ts` source. A human needs to run `cd infra && pulumi up` against the `prod` stack to apply it before the deployed app can write to GCS (locally it was verified using the developer's own `gcloud` ADC identity, which is not the same as the `api-sa` binding).
- **Local `pulumi preview` could not be run against the real `prod` stack** — `PULUMI_CONFIG_PASSPHRASE` in this worktree's `.env` does not decrypt `infra/Pulumi.prod.yaml`'s secrets (`incorrect passphrase` from the Pulumi CLI). The IAM binding's correctness was instead verified by: (1) source review — it's a bucket-scoped `BucketIAMMember`, not a project-wide `roles/storage.admin` grant; (2) a live `gcloud storage buckets get-iam-policy bedtime-prod-storage` read confirming the bucket currently has no `allUsers`/`allAuthenticatedUsers` binding. Whoever runs `pulumi up` should also run `pulumi preview` first with the correct passphrase to see the actual diff before applying.

## Post-deploy checks
- Approve one real story end-to-end in production (or the closest pre-prod equivalent available) and confirm 2-3 `story_images` rows reach `status = ready` with a fetchable image, per the Definition of Done in `spec.md`.
- Confirm the one-time backfill endpoint, run once against the ~100 existing approved stories, completes without spiking Cloud Tasks queue load (watch `maxConcurrentDispatches: 3` isn't exceeded) and produces the expected ballpark cost (~$10 total).
