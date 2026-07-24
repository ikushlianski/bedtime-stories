---
type: scenarios
branch: story-images
task: User-uploaded canonical character reference images, replacing the auto-bootstrap mechanism
state: confirmed
updated: 2026-07-22
---
# Scenarios: Character reference images for story illustrations

## Business Scenarios

SCENARIO 1: Admin uploads a reference image for a character

An admin opens a universe's character list, picks a character, and uploads a photo/drawing as that character's canonical visual reference.

What to verify:
- The image is stored in the private `bedtime-prod-storage` GCS bucket under a path derived from the character's numeric ID and a generated identifier — never from the character's name or the uploaded filename.
- A `character_reference_images` row is created, linked to the character, with the real GCS path and an `uploadedAt` timestamp.
- The character card immediately shows an updated reference-image count/thumbnail without a page reload.

SCENARIO 2: Admin uploads multiple reference images for one character

The admin uploads a second, third, etc. image for the same character (the user's own target is "about 8" images total across all characters, spread however they choose).

What to verify:
- Multiple `character_reference_images` rows can exist for one `character_id` — no unique constraint blocks it.
- The character is already usable for image generation after its first upload; later uploads add more options, they are not required to "complete" anything.

SCENARIO 3: Admin views a character's uploaded reference images

The admin reopens the character card later and sees thumbnails of everything uploaded so far.

What to verify:
- Thumbnails are served through an authenticated proxy route (mirroring the existing story-illustration serving pattern) — never a direct public GCS URL, since the bucket has no public ACL.
- A character with zero uploads clearly shows "no reference images yet" rather than an empty silent state, so the admin knows this character will be skipped during generation.

SCENARIO 4: Admin deletes a reference image

The admin removes a bad upload from a character's set.

What to verify:
- The `character_reference_images` row is deleted.
- The underlying GCS object is also deleted (not left as billed orphan storage).
- If that was the character's last reference image, the character reverts to "no references" — the next generation involving that character is gated per Scenario 7.

SCENARIO 5: Non-image or oversized file upload is rejected

The admin (or a scripted/malicious client hitting the same endpoint) tries to upload a `.pdf`, an `.exe` renamed to `.png`, or a 200MB file.

What to verify:
- Only real `image/png`, `image/jpeg`, and `image/webp` content types are accepted — validated from the actual uploaded bytes' declared MIME type via the upload middleware, not trusted from the client-supplied filename extension.
- A file over the configured size limit is rejected with a clear 4xx error before any GCS write is attempted.
- No `character_reference_images` row and no GCS object are created for a rejected upload.

SCENARIO 6: A scene naming an uploaded character generates an image using that reference

Illustration generation runs for a story. The scene-picker names a character who has at least one uploaded reference image.

What to verify:
- The character's most recently uploaded reference image is read from GCS and attached to the OpenRouter image-generation request as an `input_references` entry (`image_url` with a base64 data URL of that exact object's bytes) — not merely described in the text prompt.
- The resulting `story_images` row reaches `status = 'ready'` with `reference_image_used = true`.
- A `model_calls` row exists for `stage = 'illustration_image'` with a nonzero cost, proving the paid call actually happened for this scene.

SCENARIO 7: A scene naming a character with no uploaded reference is skipped before any paid call

The scene-picker names a character who has zero uploaded reference images (never uploaded, or all deleted per Scenario 4).

What to verify:
- `OpenRouterClient.generateImage()` (the `/api/v1/images` call) is never invoked for that scene — no network call, no cost incurred.
- The `story_images` row for that scene is written directly with `status = 'failed'` and `failure_reason = 'no reference image for character: <name>'` (all missing names listed if more than one).
- No `model_calls` row with `stage = 'illustration_image'` is created for that scene.
- Other scenes in the same story that do have all their named characters' references present are unaffected — the gate is per-scene, not per-story.

SCENARIO 8: A scene naming multiple characters, only some of whom have references, is fully skipped

A scene names two characters; one has uploaded references, the other does not.

What to verify:
- The scene is skipped entirely (same as Scenario 7) — partial generation using only the available character's reference is not attempted. The `failure_reason` names only the missing character(s), not the one that does have references.

SCENARIO 9: A scene with no named characters generates normally, ungated

The scene-picker returns a scene whose `characters_present` is empty (a pure setting/establishing shot).

What to verify:
- No reference-image check blocks this scene — it proceeds straight to generation with no `input_references` attached (unless the universe-level style guide/other future context adds one), and `reference_image_used = false`.

SCENARIO 10: The old auto-bootstrap reference mechanism no longer exists

A universe's very first successful story-illustration generation completes.

What to verify:
- `story_groups` no longer has a `reference_image_path` column, and nothing anywhere sets or reads a universe-wide "canonical reference image" auto-derived from a generation's own output.
- Character consistency going forward comes exclusively from characters' own uploaded `character_reference_images` rows — confirmed by grepping the codebase for `deriveReferenceImageUpdate` / `reference_image_path` and finding zero references outside git history.

SCENARIO 11: Deleting a character cleans up its reference images

The admin deletes a character that has 3 uploaded reference images.

What to verify:
- All of that character's `character_reference_images` rows are removed.
- A best-effort attempt is made to delete the corresponding GCS objects; a GCS deletion failure is logged but does not block the character deletion itself (mirrors the app's existing "don't let a storage-layer hiccup block the primary DB operation" tolerance already used for image generation retries).

## Technical/Architectural Scenarios

SCENARIO 12: Migration is idempotent and additive-safe

The new migration (creating `character_reference_images`, dropping `story_groups.reference_image_path`) is run twice in a row against the same database.

What to verify:
- The second run is a no-op with no error, following the existing `IF NOT EXISTS` / `DO $$ ... EXCEPTION WHEN duplicate_object` convention seen in migrations 0039–0044.
- Running the migration against the disposable verify branch used for this plan's implementation does not touch production — this plan requests its own fresh disposable Neon branch, matching the original `story-images` plan's Implementation Order step 0.
