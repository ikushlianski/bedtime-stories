---
type: spec
branch: story-images
task: User-uploaded canonical character reference images, replacing the auto-bootstrap mechanism
complexity: complex
state: confirmed
updated: 2026-07-22
---
# Spec: Character reference images for story illustrations

### Implementation Phases

Single phase implementation. Upload/manage, the gate, and the multi-image request change are small individually but only provable end-to-end together (the gate has nothing to gate on without upload working; the request-shape change has nothing to attach without the gate deciding what's attachable) — splitting into delivery phases would add coordination overhead without reducing risk.

### Derivers

| Deriver | Inputs | Output | Scenarios covered |
|---|---|---|---|
| `normalizeCharacterName` / `charactersMatch` | two character name strings | boolean (trim + case-insensitive equality) | SCENARIO 6, 7, 8 |
| `deriveReferenceImageGate` | `charactersPresent: string[]` (scene's named characters), `referenceableCharacterNames: string[]` (characters with ≥1 uploaded image) | `{ ok: boolean, missingCharacterNames: string[] }` | SCENARIO 6, 7, 8, 9 |
| `deriveCharacterReferenceImagePath` | `universeId`, `characterId`, `uuid`, `extension` | GCS object path string | SCENARIO 1 |
| `deriveContentTypeExtension` | uploaded file's MIME type string | `'png' \| 'jpg' \| 'webp' \| null` (null = reject) | SCENARIO 5 |

### Files by scenario

| Scenario | Backend files | Frontend files | Infrastructure files |
|---|---|---|---|
| SCENARIO 1 | `packages/api/src/routes/character-reference-images.ts` (new, POST), `packages/core/src/pipeline/derivers/character-reference-image-path.ts` (new), `packages/core/src/db/schema.ts` | `packages/web/src/components/universe-characters.tsx`, `packages/web/src/lib/api.ts` | None |
| SCENARIO 2 | `packages/api/src/routes/character-reference-images.ts` | `packages/web/src/components/universe-characters.tsx` | None |
| SCENARIO 3 | `packages/api/src/routes/character-reference-images.ts` (new, GET list + GET bytes) | `packages/web/src/components/universe-characters.tsx`, `packages/web/src/lib/api.ts` | None |
| SCENARIO 4 | `packages/api/src/routes/character-reference-images.ts` (new, DELETE), `packages/core/src/storage/gcs-images.ts` (new `deleteImage`) | `packages/web/src/components/universe-characters.tsx` | None |
| SCENARIO 5 | `packages/api/src/routes/character-reference-images.ts` (multer config + `deriveContentTypeExtension`) | None | None |
| SCENARIO 6 | `packages/api/src/routes/story-images.ts`, `packages/core/src/openrouter/openrouter.client.ts`, `packages/core/src/pipeline/derivers/reference-image-gate.ts` (new) | None | None |
| SCENARIO 7 | `packages/api/src/routes/story-images.ts`, `packages/core/src/pipeline/derivers/reference-image-gate.ts` | None | None |
| SCENARIO 8 | `packages/api/src/routes/story-images.ts`, `packages/core/src/pipeline/derivers/reference-image-gate.ts` | None | None |
| SCENARIO 9 | `packages/api/src/routes/story-images.ts` | None | None |
| SCENARIO 10 | `packages/core/src/pipeline/derivers/reference-image-update.ts` (deleted), `packages/core/src/db/schema.ts`, `packages/api/src/routes/story-images.ts` | None | None |
| SCENARIO 11 | `packages/api/src/routes/universes.ts` (character DELETE handler), `packages/core/src/storage/gcs-images.ts` | None | None |
| SCENARIO 12 | `packages/core/src/db/migrations/00XX_*.sql` (new, generated) | None | None |

### Files to create

```
packages/core/src/
  pipeline/
    stages/illustration-moment-selector.ts        — MODIFY: accept characterNames, include in prompt
    derivers/
      reference-image-gate.ts (+ .test.ts)          — new: deriveReferenceImageGate
      character-name-match.ts (+ .test.ts)           — new: normalizeCharacterName / charactersMatch
      character-reference-image-path.ts (+ .test.ts) — new: deriveCharacterReferenceImagePath
      content-type-extension.ts (+ .test.ts)         — new: deriveContentTypeExtension
packages/api/src/routes/
  character-reference-images.ts                     — new: POST (multipart upload), GET (list), GET /:refId (serve bytes), DELETE /:refId
packages/core/src/db/migrations/
  00XX_character_reference_images.sql                — generated via drizzle-kit generate, never hand-written
```

### Files to modify

```
packages/core/src/db/schema.ts                — add character_reference_images table; drop story_groups.reference_image_path; (no schema change to story_images.reference_image_used, only its documented meaning)
packages/core/src/storage/gcs-images.ts        — add deleteImage(path); (uploadImage/readImage unchanged, reused as-is)
packages/core/src/openrouter/openrouter.client.ts — ImageGenerationRequest: replace single referenceImageBase64/referenceImageMediaType with referenceImages: Array<{ base64: string; mediaType: string }>; build input_references from the full array
packages/core/src/pipeline/derivers/illustration-prompt.ts — unchanged (still receives an already-filtered character list; no change needed)
packages/core/src/pipeline/derivers/reference-image-update.ts — DELETE (old bootstrap mechanism)
packages/core/src/pipeline/derivers/reference-image-update.test.ts — DELETE
packages/core/src/pipeline/stages/illustration-moment-selector.ts — accept characterNames: string[], append canonical name list + instruction to the prompt
packages/api/src/routes/story-images.ts        — remove deriveReferenceImageUpdate import/call and the "reference-set-this-run" block; remove group.referenceImagePath read; add per-scene deriveReferenceImageGate check before generateSingleImage, writing a failed row and skipping the API call when it fails; on success path, read each named character's latest reference image from GCS and pass the array into generateImage()
packages/api/src/server.ts                     — mount characterReferenceImagesRouter nested under /api/universes/:universeId/characters/:charId/reference-images
packages/api/src/routes/universes.ts           — character DELETE handler: fetch + delete that character's reference images (GCS best-effort + DB rows) before deleting the character row
packages/web/src/components/universe-characters.tsx — add reference-image thumbnail grid, upload control, delete-per-image control, and a "no reference images" warning state to CharacterCard
packages/web/src/lib/api.ts                    — add UniverseCharacter.referenceImageCount; add api.universes.listCharacterReferenceImages / uploadCharacterReferenceImage / deleteCharacterReferenceImage; add a non-JSON-content-type upload helper alongside the existing `request`/`requestEmpty`
packages/api/src/routes/universes.ts (toPublic/character list queries) — include a referenceImageCount per character (single grouped count query)
packages/api/package.json                     — add multer dependency (+ @types/multer as devDependency)
docs/architecture/story-images.md              — update: remove "Reference image bootstrap" section, describe the new gate + per-character multi-image mechanism, update the sequence diagram and storage-layout section
```

### Data model changes

New table `character_reference_images` (id, character_id FK → universe_characters.id not null, gcs_path text not null, uploaded_at timestamp default now not null; no cascade, no unique constraint — multiple rows per character allowed). `story_groups.reference_image_path` column dropped (never reached production — see architecture.md → Rollout). `story_images.reference_image_used` column unchanged in shape, redefined in meaning (see architecture.md → Data model evolution).

### Documentation changes

`docs/architecture/story-images.md` (existing file, published by the original `story-images` plan) is updated in place: the "Reference image bootstrap" step (step 5 in "What happens") is removed and replaced with a description of the pre-generation gate and per-character multi-image attachment; the Mermaid sequence diagram is updated to show the gate branching before the OpenRouter call; the "Storage layout" section gains the new `character-references/universe-{id}/character-{id}/{uuid}.{ext}` path convention alongside the existing `story-images/...` one. No new doc file is created — this is a modification of an already-existing architecture doc, not a fresh one.

### Decisions made autonomously

- **Migration edits schema.ts and generates a new migration (0045), rather than hand-editing migration 0044.** Migration 0044 was drizzle-kit-generated with its own snapshot metadata; hand-editing its SQL without regenerating would desync `meta/0044_snapshot.json` from the actual schema history and corrupt future `drizzle-kit generate` diffs. Even though 0044 never reached production (confirmed: `main`'s highest migration is 0043), the tool-supported path — edit `schema.ts`, run `drizzle-kit generate` — is safer and is what "migrations are generated, never hand-written" already means in this repo's convention.
- **Name matching is normalized (trim + case-insensitive), not exact-string.** The scene-picker LLM's `characters_present` output and a character's canonical bible name can differ by case or, in Russian, by grammatical declension (e.g. "Гошу"/"Гоше" vs. bible name "Гоша"). Exact-match risked the gate legitimately blocking scenes that do name a referenced character, which would make DoD proof (a) below unreliable to demonstrate. Mitigated two ways: (1) `selectIllustrationMoments` now receives the universe's canonical character names and is instructed to use them verbatim; (2) matching itself is normalized as a safety net on top of that instruction, not a replacement for it.
- **One reference image per named character per scene — the character's most recently uploaded (`uploaded_at DESC`), not all of that character's uploads.** Keeps the request small and deterministic regardless of how many images a character accumulates toward the user's "about 8 total" target; per-provider reference-image limits (4–16 depending on model, per OpenRouter's docs) are never at risk since a scene rarely names more than 2–3 characters and moment selection caps at 3 scenes total.
- **No FK cascade on `character_reference_images.character_id`.** This schema has zero `onDelete` cascades anywhere today (verified by grep); character deletion instead explicitly fetches and deletes reference images (DB rows + best-effort GCS objects) in the existing character DELETE handler, consistent with how that same handler already does an explicit application-level check (blocking deletion if a story still references the universe) rather than relying on DB-level cascade/restrict behavior.
- **GCS object path for uploads is built only from `universeId` + `characterId` + a generated UUID + a content-type-derived extension — never from the character's name or the client-supplied filename.** Prevents path traversal / injection via untrusted input, per this project's standing rule to treat all uploaded/external input as untrusted.
- **Upload accepts `image/png`, `image/jpeg`, `image/webp` only, validated by declared MIME type via `multer`'s `fileFilter`, with a size limit via `multer`'s `limits.fileSize` (8MB — generous for a character portrait, small enough to bound cost/storage risk).** Anything else is rejected before any GCS write or DB insert.
- **Upload mechanism is a direct multipart POST through a new authenticated Express route using `multer` (memory storage) — not a signed-URL-then-confirm flow.** Mirrors the original `story-images` plan's own reasoning for avoiding GCS signed URLs (`roles/iam.serviceAccountTokenCreator` would be a new IAM surface neither the bucket nor `api-sa` currently has); the app already has an authenticated request path and the existing `uploadImage()` GCS wrapper, so the server acting as a thin proxy for the upload bytes reuses both with zero new IAM permissions. `multer` (current major 2.x, actively maintained — v2.2.0 published 2026-06-15 per npm — chosen over `busboy`/hand-rolled multipart parsing since it's the de facto standard Express multipart middleware and the rewrite specifically targeted Express-generation compatibility and the CVEs of `multer` 1.x).
- **`character_reference_images` has no `content_type` column.** Content type is read back from GCS object metadata at serve time via the same `readImage()` helper the existing story-illustration proxy route already uses — avoiding a second source of truth for the same fact.
- **A character "has canonical references" the moment it has ≥1 uploaded image; no "reference set complete" flag exists in v1.** Matches the task's explicit instruction that "about 8" is the user's own quality target, not a system-enforced minimum.
- **Scope relationship to the open wishlist item "Generated story illustrations default to photorealistic, not the requested cartoon/comic style" is explicitly NOT resolved by this plan as a deliverable.** That defect's root cause is `visualStyleGuide` being null on every universe, a separate text field describing overall rendering style (independent of per-character likeness). Passing real character reference images as image-to-image input is expected to meaningfully reduce photorealism as a side effect (the model tends to echo qualities of its input images), but this plan makes no code change to force a default style guide and does not claim to close that wishlist item — it remains open, to be addressed independently (e.g. seeding a default `visualStyleGuide`).
- **The gate's `failure_reason` lists every missing character name for a scene, comma-separated (`no reference image for character: A, B`), not just the first.** More actionable for the admin than truncating to one name, and costs nothing extra to compute since `deriveReferenceImageGate` already returns the full list.

### Implementation order

0. Request a fresh disposable Neon branch for implementation-phase DB work.
1. `/tdd normalizeCharacterName` / `charactersMatch` — covers SCENARIO 6, 7, 8
2. `/tdd deriveReferenceImageGate` — covers SCENARIO 6, 7, 8, 9
3. `/tdd deriveCharacterReferenceImagePath` — covers SCENARIO 1
4. `/tdd deriveContentTypeExtension` — covers SCENARIO 5
5. `packages/core/src/db/schema.ts` changes (new table, drop column) → `drizzle-kit generate` → review generated migration for the `IF NOT EXISTS`/`DO $$ EXCEPTION` idempotency shape → `npm run db:migrate` against the fresh disposable branch
6. `gcs-images.ts` → add `deleteImage()`
7. `openrouter.client.ts` → change `ImageGenerationRequest` to `referenceImages: Array<{ base64, mediaType }>`, rebuild `input_references` from the array
8. `character-reference-images.ts` route (multer upload, list, serve-bytes, delete) + mount in `server.ts`
9. `universes.ts` character DELETE handler → cleanup wiring; character list/detail → `referenceImageCount`
10. `illustration-moment-selector.ts` → accept and pass through `characterNames`
11. `story-images.ts` orchestration: remove old bootstrap block, wire the new gate + per-character reference lookup + multi-image `generateImage()` call
12. Delete `reference-image-update.ts` + its test
13. Frontend: `universe-characters.tsx` upload/thumbnail/delete UI, `api.ts` client methods
14. `docs/architecture/story-images.md` update

### Scope boundary

**In scope**: uploading, listing, and deleting per-character reference images through a real admin UI; storing them in GCS under a path safe from path traversal; gating illustration generation per-scene on every named character having at least one reference image, with zero paid API calls for a scene that fails the gate; attaching each named character's most recent reference image to the OpenRouter request as real image input; complete removal of the old auto-bootstrap mechanism (`reference_image_path`, `deriveReferenceImageUpdate`).

**Explicitly out of scope for v1**: fixing the separate `visualStyleGuide`-is-null photorealism wishlist item (see Decisions made autonomously); a "reference set complete" flag or any minimum-image-count enforcement; reordering/labeling individual reference images (e.g. "primary" vs "alternate" pose); bulk upload (multiple files in one request — v1 is one file per upload action, matching "let me upload an image" singular framing); any change to the existing per-scene retry/moderation/storage-error handling for scenes that do pass the gate; uploading the real ~8 character images (user does this themselves after ship).

---

### Definition of Done — per layer

**Backend — Scenario 6 (positive proof, reference actually used, not just "API call succeeded")**: Using synthetic placeholder image files (e.g. a small solid-color PNG, never real character art), upload ≥1 reference image for a real character in a real universe via the new upload route against the disposable verify database. Trigger `generateStoryImages` for a story whose scene-picker output names that character in at least one scene (a real scene text can be crafted/seeded to guarantee this, or an existing story naturally containing the character can be used). Prove reference usage at the request layer — the layer where it is actually machine-checkable, since visual influence on the output pixels is not: capture the exact request body `generateImage()` sends to OpenRouter (via a temporary debug log of the assembled `input_references` array, or by intercepting the call in a short-lived verification script) and confirm it contains an `image_url` entry whose base64 payload byte-for-byte matches the bytes just read from that character's `gcs_path` in GCS — not merely that `input_references` is non-empty. Then confirm the resulting `story_images` row directly in the database: `status = 'ready'`, `reference_image_used = true`, and a `model_calls` row exists with `stage = 'illustration_image'` and nonzero `usd_micros` for that story.

**Backend — Scenario 7/8 (negative proof, gate actually prevents the paid call, not just "returns an error")**: Using a character with zero uploaded reference images (freshly created, or one whose only reference was deleted via Scenario 4's delete path), trigger `generateStoryImages` for a scene naming that character. Two proofs, both required: (1) a database check — after the run completes, query `model_calls` for `stage = 'illustration_image'` scoped to that story/scene and confirm zero rows exist (the free `illustrationMomentSelector`-stage LLM call is expected and is not part of this check — only the paid image-generation stage must show zero calls); confirm the `story_images` row for that scene shows `status = 'failed'` and `failure_reason` starting with `'no reference image for character: '` and naming the correct character. (2) a permanent automated regression test that mocks/spies `OpenRouterClient.generateImage` (or the underlying `fetch` call to `/api/v1/images`) around the gate-and-orchestration wiring and asserts the spy's call count is exactly zero when the gate fails — kept in the test suite going forward specifically because this is a cost-safety property, not incidental plumbing, and deserves a standing regression guard beyond the one-time manual DB check.

**Backend — general**: `tsc --noEmit` clean, project lint clean, all new deriver unit tests pass (`normalizeCharacterName`/`charactersMatch`, `deriveReferenceImageGate`, `deriveCharacterReferenceImagePath`, `deriveContentTypeExtension`), full existing suite (currently 76/76 files, 514/514 tests per the original plan's verification) still passes after `reference-image-update.ts`/`.test.ts` removal.

**Infrastructure**: The disposable verify Neon branch's `character_reference_images` table and dropped `story_groups.reference_image_path` column are confirmed directly via `mcp__Neon__run_sql` / `describe_table_schema` against that branch, not inferred from the migration file alone. The uploaded synthetic image's GCS object is confirmed to actually exist at the recorded `gcs_path` (via `gcloud storage cat` or the GCS API), is non-empty, and has the expected content type — not just that the upload call returned success. A deleted reference image (Scenario 4) is confirmed to no longer exist in GCS after deletion, not just removed from the database row. Post-deploy, the `api-sa` service account's existing GCS IAM binding is confirmed (by reading the applied Pulumi state/IAM policy, not just source) to be bucket-scoped rather than prefix-scoped, so the new `character-references/` object prefix is covered without any infra change — no new `BucketIAMMember` is expected or required for this plan.

**Frontend**: Loading a universe's character list page in a real authenticated browser session, uploading a synthetic placeholder image through the new UI for a character with zero references, and observing the character's reference-image count/thumbnail update without a manual page reload — verified by actual screenshot or visual inspection, not by asserting the API response shape alone. A character with zero reference images visibly shows a "no reference images yet" state distinguishable from a character that has some, confirmed the same way. Deleting a reference image through the UI removes its thumbnail from the visible grid.
