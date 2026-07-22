---
type: todo
branch: story-images
task: User-uploaded canonical character reference images, replacing the auto-bootstrap mechanism
state: open
updated: 2026-07-22
---
# Todo: Character reference images for story illustrations

## Decisions to make
Nothing to decide.

## To review / clarify
Nothing to review.

## Manual steps
- Request a fresh disposable Neon branch before implementation-phase DB work — the current worktree's `story-images-verify` branch expires imminently (2026-07-22T11:00 UTC) and must not be reused for building or verifying against, per this repo's Neon safety convention.
- The user will upload the real ~8 character reference images themselves after this feature ships — implementation-phase verification uses synthetic/placeholder image files (e.g. small solid-color PNGs), never real character art, per the task's explicit scope boundary.

## Post-deploy checks
- Confirm the `api-sa` service account's existing GCS IAM binding (already scoped to `bedtime-prod-storage` from the original `story-images` plan) covers the new `character-references/` object prefix — it does, since the binding is bucket-scoped, not prefix-scoped, but worth a one-line sanity check reading the deployed Pulumi state before considering this done.
