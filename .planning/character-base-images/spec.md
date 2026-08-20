---
type: spec
branch: main
task: character base/portrait images
complexity: complex
state: confirmed
updated: 2026-08-21
---
# Spec: character base/portrait images

### Summary

Every character in a universe's character bible can get an AI-generated portrait image, triggered manually (never automatically) via a "Generate portrait" button, plus a separate multi-file upload for user-supplied baseline reference images. Generation always resolves exactly one image source through a fixed 3-tier fallback — the character's own uploaded references, else up to 3 existing portraits from other characters in the same universe (for style matching only), else the app's bundled default style image — and always renders one character alone in a clean portrait/headshot presentation, never a scene. Generation goes through OpenRouter's dedicated image endpoint (`google/gemini-2.5-flash-image`); results and uploads are stored in the GCS bucket this project already provisioned but never used; cost is recorded through the same call-tracking table every text generation already uses.

### Implementation Phases

Single phase implementation. The work is naturally layered (derivers, then the OpenRouter/storage integrations, then routes, then UI) but ships as one connected feature — there's no meaningful intermediate deployable state between "database ready" and "button works end to end."

### Derivers

| Deriver | Inputs | Output | Scenarios covered |
|---|---|---|---|
| `deriveReferenceTier` | `{ ownReferenceValues: string[], siblingPortraitValues: string[] }` (storage paths, not URLs — this deriver only picks and caps, it doesn't know or care whether a value ends up signed or public) | `{ tier: 'own_reference' \| 'universe_sibling' \| 'default_style', referenceValues: string[] }` (sibling list capped at 3 inside the function; `siblingPortraitValues` must already exclude the character being generated — enforced by the caller, `load-portrait-candidates.ts`, not by this pure function) | 2, 3, 4, 5 |
| `buildPortraitPrompt` | `{ name, description, age, traits }` (character bible fields) + `tier` | prompt string — tier 1 asks the model to match the uploaded appearance; tiers 2/3 explicitly ask it to invent the character's appearance and match only the art style; all tiers state "single character, no scene, portrait/headshot" | 2, 3, 4 |
| `validateReferenceUpload` | `{ mimetype: string, sizeBytes: number }` + current upload-batch count | `{ ok: true } \| { ok: false, reason: string }` | 1 |
| `buildCharacterAssetPath` | `{ kind: 'reference' \| 'portrait', characterId: number, fileId: string, extension: string }` (`fileId` is caller-supplied, e.g. `crypto.randomUUID()` — kept an input rather than generated inside so this stays pure/testable) | GCS object path string — `kind` maps to a **top-level** prefix (`references/...` or `portraits/...`), not nested under a shared `characters/{id}/` prefix, so the two kinds can get different bucket-level IAM treatment by prefix alone (see Decisions) | 1, 2, 3, 4, 5 |
| `buildPublicObjectUrl` | `{ bucketName: string, storagePath: string }` | the deterministic `https://storage.googleapis.com/<bucket>/<path>` URL — pure string formatting, no GCS call; only ever correct to use on a path under the publicly-readable `portraits/` prefix | 2, 3, 4, 5 |

### Files by scenario

| Scenario | Backend files | Frontend files | Infrastructure files |
|---|---|---|---|
| 1 — Upload references | `packages/api/src/routes/universe-character-reference-images.ts`, `packages/core/src/character-portraits/validate-reference-upload.ts`, `packages/core/src/character-portraits/save-reference-image.ts`, `packages/api/src/storage/gcs-object-storage.ts` | `packages/web/src/components/character-reference-images.tsx`, `packages/web/src/lib/api.ts` | None |
| 2 — Own-reference portrait | `packages/api/src/routes/universe-character-portrait.ts`, `packages/core/src/character-portraits/generate-portrait.ts`, `packages/core/src/character-portraits/derive-reference-tier.ts`, `packages/core/src/character-portraits/build-portrait-prompt.ts`, `packages/core/src/openrouter/openrouter.client.ts`, `packages/core/src/openrouter/openrouter.runner.ts` | `packages/web/src/components/character-portrait-panel.tsx` | None |
| 3 — Sibling-style portrait | `packages/core/src/character-portraits/load-portrait-candidates.ts` (sibling query, capped/ordered), same generation files as Scenario 2 | Same as Scenario 2 | None |
| 4 — Default-style portrait | `packages/core/src/character-portraits/generate-portrait.ts` (reads `packages/core/src/pipeline/assets/default-character-style-reference.png` from disk, base64-encodes it) | Same as Scenario 2 | None |
| 5 — Regenerate, keep up to 3 previous | `packages/core/src/character-portraits/generate-portrait.ts` (insert new current row, flip old current to previous, prune beyond 3 previous), `packages/api/src/routes/universe-character-portrait.ts` (new GET portrait-history endpoint) | `packages/web/src/components/character-portrait-panel.tsx` (previous-portraits strip) | None |
| 6 — Delete reference image | `packages/api/src/routes/universe-character-reference-images.ts` (DELETE route) | `packages/web/src/components/character-reference-images.tsx` | None |
| 7 — No auto-generation | No new file — verified by the absence of any portrait call in the existing create/update character routes (`packages/api/src/routes/universes.ts` unchanged in this respect) | `packages/web/src/components/universe-characters.tsx` (empty-state rendering) | None |
| 8 — Generation call fails | `packages/core/src/character-portraits/generate-portrait.ts`, `packages/core/src/cost/cost-recorder.ts` | `packages/web/src/components/character-portrait-panel.tsx` (error state) | None |
| 9 — Save fails after billed call | `packages/core/src/character-portraits/generate-portrait.ts` | `packages/web/src/components/character-portrait-panel.tsx` (distinct error message) | None |
| 10 — No double-bill on double-click | None (client-side only) | `packages/web/src/components/character-portrait-panel.tsx` (disabled-while-pending state) | None |
| 11 — Delete character with images attached | `packages/api/src/routes/delete-character-cascade.ts` (new), `packages/api/src/routes/universes.ts` (character DELETE route calls it) | None | None |

### Files to create

```
packages/core/src/character-portraits/
  derive-reference-tier.ts              — pure: which tier + which reference URLs to use
  derive-reference-tier.test.ts
  build-portrait-prompt.ts              — pure: character bible + tier -> prompt text
  build-portrait-prompt.test.ts
  build-character-asset-path.ts         — pure: GCS object path naming (top-level `references/`/`portraits/` prefix)
  build-character-asset-path.test.ts
  build-public-object-url.ts            — pure: deterministic public URL for a path under `portraits/` — no GCS
                                           call, just string formatting; never used for `references/` paths
  build-public-object-url.test.ts
  validate-reference-upload.ts          — pure: mimetype/size/count checks
  validate-reference-upload.test.ts
  load-portrait-candidates.ts           — DB reads: own reference storage paths, sibling portrait storage paths
                                           (capped 3, most-recent-first, EXCLUDES the character being generated) —
                                           returns paths, never signs or builds URLs itself (core has no GCS SDK)
  load-characters-with-portrait.ts      — DB read: character rows joined with their current portrait row's storage
                                           path — the calling route layer converts that path to a public URL via
                                           `build-public-object-url.ts` before it reaches the frontend
  save-reference-image.ts               — orchestration: one uploaded file -> GCS `references/...` -> DB row
                                           (stores the storage path, not a URL — see Decisions); returns the new
                                           row's storage path back to the route, which signs it before responding
                                           — this function itself does not sign, keeping "which URL a caller gets
                                           and for how long" a route-layer concern, not baked into the write path
  generate-portrait.ts                  — orchestration: model_catalog pre-flight check -> tier resolution ->
                                           for tier `own_reference`, sign each selected reference's storage path
                                           fresh (short-lived, one-time use) right before the OpenRouter call; for
                                           tier `universe_sibling`, build public URLs for the (already-public)
                                           sibling portraits; for `default_style`, read+base64 the local asset ->
                                           OpenRouter -> upload result to GCS `portraits/...` -> DB write (new
                                           current row storing the storage path + which source values were used,
                                           flip old current to previous, prune previous rows beyond 3) -> cost record
packages/core/src/storage/
  object-storage.interface.ts           — ObjectStorage interface: `upload`, `getSignedReadUrl`, `delete` — no
                                           `getPublicUrl` method here, that's the separate pure deriver above, since
                                           a public URL needs no GCS call and no injected implementation at all;
                                           core never imports `@google-cloud/storage` directly
packages/api/src/storage/
  gcs-object-storage.ts                 — ObjectStorage implementation, dynamic-imports @google-cloud/storage
                                           (mirrors the existing @google-cloud/tasks dynamic-import pattern in
                                           pipeline-dispatch.ts); `getSignedReadUrl` calls the client's
                                           `file.getSignedUrl({ version: 'v4', action: 'read', expires })`, which
                                           on Cloud Run signs via the IAM `signBlob` API using the attached service
                                           account's own identity (no key file) — needs the new self-impersonation
                                           IAM binding described under Infrastructure below
packages/api/src/routes/
  universe-character-reference-images.ts — POST (multipart upload, multer memory storage) / GET / DELETE. POST and
                                            GET both return each reference image as `{ id, url, uploadedAt }` where
                                            `url` is a freshly signed, short-lived read URL generated at request
                                            time (~1 hour expiry) — the response never includes the raw storage
                                            path, and nothing about a reference image is ever publicly reachable
                                            without going through this signing step.
  universe-character-portrait.ts         — POST (trigger generation) / GET portrait-history (up to 3 previous).
                                            Portraits are public, so these just return the plain public URL built
                                            from the stored path — no signing needed here.
  delete-character-cascade.ts            — deletes a character's reference-image, portrait, and cost-tracking rows
                                            before the character row itself — mirrors delete-story-cascade.ts
packages/web/src/components/
  character-portrait-panel.tsx          — current portrait, tier badge, Generate/Regenerate button, loading + error
                                           states, read-only "previous portraits" thumbnail strip (view-only, no restore)
  character-reference-images.tsx        — multi-file upload input, thumbnail grid, per-image delete; renders each
                                           thumbnail from the signed `url` the API already returned — never
                                           constructs or guesses a GCS URL itself, and a stale signed URL (page left
                                           open past its ~1 hour expiry) just means re-opening the character's
                                           reference list re-fetches and re-signs, not a persistent broken image
docs/architecture/
  06-character-portraits.md             — new numbered doc following this repo's existing flat docs/architecture/ convention
  diagrams/06-character-portraits.mmd
  img/06-character-portraits.png
```

### Files to modify

```
packages/core/src/db/schema.ts
  — add `characterReferenceImages` table (id, characterId FK -> universeCharacters, storagePath, uploadedAt) —
    `storagePath` (not `imageUrl`) because a reference object has no stable public URL any more; it's a bucket-
    relative path like `references/42/<uuid>.png` that only becomes reachable through a freshly signed URL
  — add `characterPortraits` table (id, characterId FK -> universeCharacters, storagePath, tier
    ($type<'own_reference' | 'universe_sibling' | 'default_style'>()), sourceStoragePaths (jsonb, nullable,
    string[] — which reference/sibling storage paths fed this generation; null for the default-style tier),
    isCurrent (boolean, default false), generatedAt (timestamp, default now())) — also `storagePath`, not a
    URL, for the same reason and for consistency between the two tables, even though portraits happen to be
    public: the public URL is always derivable from the path via `build-public-object-url.ts`, so storing
    both would just be a redundant, driftable copy of the same information
  — add to `modelCalls`: characterId (integer, nullable, FK -> universeCharacters) alongside the existing
    nullable storyId — must not remove or change storyId's nullability
  — NOTE: no columns are added directly to `universeCharacters` — the "current portrait" is the row in
    `characterPortraits` with `isCurrent = true` for that character, not a denormalized column (see Data
    model changes below for why this replaced an earlier 3-column draft)

packages/core/src/ai/runner.interface.ts
  — add RunImageOptions ({ model, prompt, referenceImageUrls?: string[], stage?: string, characterId?: number })
    and RunImageResult ({ imageBase64: string, mediaType: string }) — `referenceImageUrls` here is genuinely a
    list of URLs (mixed signed-and-public is fine), already resolved by the caller (`generate-portrait.ts`)
    before this options object is built; the OpenRouter layer itself has no concept of signing or paths

packages/core/src/ai/index.ts
  — export the new types alongside the existing RunTextOptions/RunStructuredOptions exports

packages/core/src/openrouter/openrouter.client.ts
  — add `generateImage(req: { model: string; prompt: string; inputReferences?: string[] }): Promise<{ imageBase64: string; mediaType: string; usage: OpenRouterUsage }>`
    hitting `POST /images` (separate endpoint from chat/completions — verified live, see Decisions). Reads
    `data[0].b64_json` and `data[0].media_type` from the response; usage comes from the same `usage.cost`
    field text calls already use.

packages/core/src/openrouter/openrouter.runner.ts
  — add `generateImage(options: RunImageOptions): Promise<RunImageResult>` to `OpenRouterRunner`, single attempt
    (no fallback-model retry — see Decisions), recording success/failure through the existing `this.recorder.record()`
    call with the new `characterId` field, and logging through the existing langfuse `generation` pattern.
    Do NOT add this to the `AiRunner` interface's required methods (text-only implementations don't need it) —
    add it as an extra method on the concrete `OpenRouterRunner` class, called directly via the `aiRunner` export.
  — before calling the client at all, look up whether `options.model` exists in `modelCatalog`; if it doesn't,
    throw immediately without calling OpenRouter (fail fast — see the model_catalog pre-flight note under
    Data model changes; this is what makes a missing catalog row a loud, pre-spend error instead of a silent
    unrecorded cost after the fact).

packages/core/src/cost/cost-recorder.ts
  — extend `RecordCallInput` with optional `characterId?: number | null`; pass it through to the `modelCalls` insert.

packages/core/src/env.ts
  — add `GCS_BUCKET_NAME: z.string().default('bedtime-prod-storage')` to the zod schema (not required — see Decisions).

packages/core/src/pipeline/assets/default-character-style-reference.png
  — re-saved at a smaller resolution before this ships (currently 3.4MB, which becomes a ~4.5MB base64 payload
    on every tier-3 generation call — the exact tier a brand-new universe's very first character always hits).
    Downscale to roughly 1024px on the long edge and re-export; it's used purely as an art-style reference, not
    for pixel-level detail, so this loses nothing the feature needs. See Decisions.

packages/api/package.json
  — add dependencies: `@google-cloud/storage`, `multer` (pin `^2.2.0` — the current stable major; the 1.x line
    is effectively unmaintained with known advisories, 2.x is the actively released line); add devDependency
    `@types/multer`.

packages/api/src/server.ts
  — mount the two new routers the same way `universesRouter` is already mounted: both use paths under
    `/api/universes/:id/characters/:charId/...`, so mount both at `/api/universes` alongside the existing line.

packages/api/src/routes/universes.ts
  — `toPublic()` and the `GET /:id/characters` route currently return raw `universeCharacters` rows; switch
    both to `load-characters-with-portrait.ts`'s helper so each character in the response carries its current
    portrait (or `null`) without the frontend needing a second round-trip per character
  — extend the existing `DELETE /:id/characters/:charId` handler to call the new `delete-character-cascade.ts`
    helper before deleting the character row itself (covers SCENARIO 11)

packages/web/src/lib/api.ts
  — extend `UniverseCharacter` with `currentPortrait: { imageUrl: string; tier: 'own_reference' | 'universe_sibling' | 'default_style'; generatedAt: string } | null`
    (`imageUrl` here is the plain public URL — portraits need no signing)
  — add `CharacterReferenceImage { id, characterId, url, uploadedAt }` — `url` is the API's freshly-signed,
    short-lived read URL (see the reference-images route above), never a raw storage path; the frontend type
    intentionally has no `storagePath` field at all, since it has no legitimate use for one
  — add `CharacterPortraitHistoryEntry { id, imageUrl, tier, generatedAt }` (also a plain public URL)
  — add a `requestFormData<T>(path, formData, method)` helper alongside the existing `request`/`requestEmpty`
    (must NOT set a JSON `Content-Type` header — the browser sets the multipart boundary itself)
  — add under `api.universes`: `listReferenceImages`, `uploadReferenceImages`, `deleteReferenceImage`,
    `generatePortrait`, `getPortraitHistory`

packages/web/src/components/universe-characters.tsx
  — render `CharacterPortraitPanel` in the character card's view mode (next to name/description); it fetches
    portrait history lazily (only when opened), current portrait comes for free on the already-loaded character
  — render `CharacterReferenceImages` in the card's editing mode, alongside `CharacterBibleFields`

infra/index.ts
  — add a `gcp.storage.BucketIAMMember` granting `roles/storage.objectAdmin` on `storageBucket.name` to
    `apiSa.email` (bucket-scoped, not `gcp.projects.IAMMember` project-wide) — covers reading, writing, and
    deleting objects under both `references/` and `portraits/`, needed regardless of which prefix
  — add a second `gcp.storage.BucketIAMMember` granting `roles/storage.objectViewer` to `allUsers`, scoped
    with a `condition` so it applies **only** to the `portraits/` prefix, not the whole bucket:
    `condition: { title: "public-read-portraits-only", expression: 'resource.name.startsWith("projects/_/buckets/bedtime-prod-storage/objects/portraits/")' }`
    (verified pattern — object-prefix IAM Conditions on Cloud Storage use exactly this `resource.name.startsWith(...)`
    form, and require uniform bucket-level access, which this bucket already has). Objects under `references/`
    are covered by neither binding, so they are unreachable except through a signed URL the API generates.
  — add a `gcp.serviceaccount.IAMMember` granting `apiSa` `roles/iam.serviceAccountTokenCreator` **on itself**
    (`serviceAccountId: apiSa.name`, `member: pulumi.interpolate\`serviceAccount:${apiSa.email}\``) — this is
    what lets `@google-cloud/storage`'s `getSignedUrl()` work under Cloud Run's attached-identity credentials
    with no private key file: without it, signing calls the IAM `signBlob` API, which requires this
    self-impersonation permission; without the role, every signed-URL call (both reference-image display and
    the own-reference tier of portrait generation) fails outright

.env.example
  — add a commented `GCS_BUCKET_NAME=` line noting the default, and a one-line pointer to the local-dev
    GCS credentials note below

docs/ci-cd/local-dev.md
  — add a short note: exercising the reference-upload/portrait-generation endpoints locally needs Google
    Application Default Credentials available inside the API container (e.g. `gcloud auth application-default
    login` on the host plus mounting `~/.config/gcloud` into the container, or a downloaded service-account
    key referenced via `GOOGLE_APPLICATION_CREDENTIALS`) — the rest of the app runs fine without this

docs/architecture/01-system-overview.md
  — update the storage bullet from "provisioned for future use" to describe its actual use (character
    reference images and generated portraits)

docs/architecture/05-data-model.md
  — add `character_reference_images` and the three new `universe_characters` columns and the new
    `model_calls.character_id` column to the ER diagram

docs/architecture/README.md
  — add the new `06-character-portraits.md` row to the doc index table
```

### Data model changes

New table for uploaded baseline/reference images:

```
character_reference_images
  id             serial primary key
  character_id   integer not null references universe_characters(id)
  storage_path   text not null   -- e.g. "references/42/<uuid>.png" — a bucket-relative path, not a URL;
                                  -- these objects carry no public-read grant (see Decisions), so a stable
                                  -- URL doesn't exist — every read goes through a freshly signed URL instead
  uploaded_at    timestamp default now()
```

New table for generated portraits — **revised from this plan's first draft**. The first draft tracked only the current portrait as three columns directly on `universe_characters`, on the reasoning that GCS's own bucket versioning already gives a recovery path if a regenerate ever needs undoing. The product owner reviewed this and asked for genuinely retained history instead — up to 3 previous portraits per character, not just whatever GCS happens to still have a version of. That needs real rows, which in turn made a separate table the natural shape (the same shape `character_reference_images` above already uses for its own one-to-many relationship), rather than trying to cram "current plus up to 3 previous" into fixed columns on the character itself:

```
character_portraits
  id                    serial primary key
  character_id          integer not null references universe_characters(id)
  storage_path          text not null   -- e.g. "portraits/42/<uuid>.png" — a bucket-relative path; portraits ARE
                                         -- publicly readable (see Decisions), so the public URL is always just
                                         -- `build-public-object-url.ts` applied to this path, never stored twice
  tier                  text not null  -- 'own_reference' | 'universe_sibling' | 'default_style'
  source_storage_paths  jsonb, nullable  -- the specific reference/sibling storage paths fed into this generation
                                         -- (own references' private paths, or sibling portraits' public paths);
                                         -- null for the default-style tier (nothing character-specific was used)
  is_current            boolean not null default false
  generated_at          timestamp default now()
```

A character's current portrait is the row with `is_current = true`. Generating a new portrait: (1) flips the existing current row, if any, to `is_current = false`; (2) inserts the new row as current; (3) if that character now has more than 3 non-current rows, deletes the oldest of them until exactly 3 remain. A dropped-off row's underlying GCS object is left in place (see reference-image deletion below) — bucket versioning is still the only recovery path *beyond* the 3 that are actively kept, which is a narrower gap than the first draft's "beyond 1," not a full history.

Extend `model_calls`:

```
character_id   integer, nullable, references universe_characters(id)
```

Migration generated via `npx drizzle-kit generate`, applied via `npm run db:migrate` — never `drizzle-kit migrate` directly (hangs on Neon's driver per this repo's own CLAUDE.md).

**Pre-flight dependency, enforced in code, not just documented**: `model_calls.model_id` is a foreign key into `model_catalog.id`. `packages/core/src/cost/cost-recorder.ts`'s insert is wrapped in try/catch and only `console.error`s on failure — it does not throw. That means if `google/gemini-2.5-flash-image` isn't yet a row in `model_catalog` when someone clicks "Generate portrait," the OpenRouter call still succeeds and is still billed, but the cost row silently never lands — the opposite of the loud failure an earlier draft of this plan assumed, and it defeats the one thing this feature is supposed to prove out (that portrait generation costs are tracked the same way text generation costs already are). `generate-portrait.ts` therefore checks `model_catalog` for this row itself *before* calling OpenRouter, and refuses with a clear error if it's missing — turning a "spent money, lost the record" failure into a "no money spent, clear error" one. The existing nightly catalog-sync job should populate this row automatically once the model has existed on OpenRouter for a day, but this guard exists so a same-day gap fails safe rather than fails silent.

### Seed data

This repo has no scripted seed mechanism — automated tests mock the DB client directly (see the `vi.mock('@bedtime/core/db/client', ...)` pattern already used throughout `packages/api/src/routes/*.test.ts`), and manual verification is done against the real accumulated data on the Neon dev branch (already populated with real universes and characters from ongoing use, per this repo's local-dev setup).

| Scenario | Realistic data needed | Source |
|---|---|---|
| 2 (own-reference portrait) | One existing character with at least one uploaded reference image | Upload one via Scenario 1 against any real dev-branch character before testing |
| 3 (sibling-style portrait) | A universe with at least one character that already has a generated portrait, and a second character with none | Generate one portrait first (Scenario 2 or 4), then generate a second character in the same universe |
| 4 (default-style, first ever) | A universe where no character has any reference or portrait yet | Any freshly created universe on the dev branch, or a real universe before its first-ever generation |
| 1, 5, 6, 7, 8, 9, 10 | Verifiable against a single existing character with no special setup | Any real dev-branch character |
| 11 (delete cascade) | A character with at least one uploaded reference, one generated portrait, and one prior (non-current) portrait | Combine setup from scenarios 1 and 5 against one throwaway test character, then delete it |

### Documentation changes

- `docs/architecture/06-character-portraits.md` created — new component doc following this repo's existing flat, numbered `docs/architecture/` convention (not a nested `<domain>/<component>` path — this repo doesn't use that layout; it uses one flat file per subsystem, each with a companion `.mmd`/`.png`, indexed in `README.md`). Plain-language explanation plus the diagram already produced for this plan (`architecture-diagram.mmd`/`.png` in this planning folder, to be copied/adapted into `diagrams/06-character-portraits.mmd` and `img/06-character-portraits.png`).
- `docs/architecture/01-system-overview.md` updated — the GCS bucket bullet currently says "for future use"; this ships that use.
- `docs/architecture/05-data-model.md` updated — ER diagram gains `character_reference_images`, `character_portraits`, and the new `model_calls.character_id` column.
- `docs/architecture/README.md` updated — new row in the doc index table.

### Decisions made autonomously

- Plan folder is `.planning/character-base-images/` (flat, no ticket prefix) — matches this repo's own existing `.planning/` layout (flat topic-slug folders; see `reference-story-input/`, `gh201-.../`), not the IE constitution's Linear-issue-keyed default — this repo has no Linear ticket and isn't an IE-platform repo.
- Image generation is a new OpenRouter integration hitting `POST /images`, a separate endpoint from `/chat/completions` — this is now a verified fact, not just a documentation reading: a live call was made against production OpenRouter with `model: "google/gemini-2.5-flash-image"` and a plain text prompt (no references) during planning, and it returned exactly the documented shape — `data[0].b64_json` (a ~1.2MB base64 PNG), `data[0].media_type: "image/png"`, and `usage.cost: 0.0387509` (about 3.9 cents for that one call). The existing `chatNonStream`/`chatStream` methods have no image-generation contract for this model and cannot be reused. The `input_references` array (used for tiers 1 and 2) is still verified only against documentation, not a live call with references attached — a defensible remaining gap given the base contract is now confirmed and the failure path (Scenario 8) already handles a rejected request cleanly.
- The task brief noted `model_catalog.image_usd_per_request` sits unused and framed this feature as what finally uses it. This plan does **not** use that field — it records the real, call-specific `usage.cost` OpenRouter returns instead (the same field text-generation cost recording already reads), because it's the actual billed amount rather than a catalog-level estimate. `image_usd_per_request` stays exactly as unused as it was; nothing about this decision requires touching it.
- **RESOLVED by the product owner (this plan's open item is now closed):** generated portraits stay public-read; uploaded reference images are private, served only via signed, time-limited URLs the API generates on demand. This is implemented as a genuine split, not a policy applied uniformly and hoped for: the two kinds of object live under different top-level bucket prefixes (`portraits/` and `references/`, not both nested under a shared `characters/{id}/` prefix), and the bucket's public-read IAM binding carries a `condition` scoping it to `portraits/` only — verified against Google's own documented pattern for object-prefix IAM Conditions (`resource.name.startsWith("projects/_/buckets/<bucket>/objects/<prefix>")`), not invented. `references/` objects are covered by neither the public binding nor any other standing grant; the only way to read one is a signed URL minted at request time by the API (which already has read access to the whole bucket via its own `roles/storage.objectAdmin` binding). This needed one more IAM addition beyond what the original draft anticipated: the API's service account needs `roles/iam.serviceAccountTokenCreator` granted to *itself*, because generating a signed URL under Cloud Run's attached-identity credentials (no private key file) goes through the IAM `signBlob` API, which requires that self-impersonation permission — verified via the `@google-cloud/storage` client library's own documentation, not assumed.
- Signed URLs use two different expiries for two different purposes: ~10 minutes when generated fresh right before an OpenRouter generation call (used once, by OpenRouter's backend, well within the app's own 180-second request timeout), and ~1 hour when generated for displaying reference-image thumbnails in the UI (long enough that a normal browsing session doesn't see them expire; if one does go stale, re-opening that character's reference list simply re-fetches and re-signs — no polling or background refresh was added to prevent this, since it's a minor, self-healing edge case, not a broken feature).
- Both `character_reference_images` and `character_portraits` store a bucket-relative `storagePath`, never a URL — a public URL is always derivable from a portrait's path via a pure, no-network-call deriver, and a reference's path is only ever turned into a URL by signing it fresh at the moment it's actually needed (either for display, or for the one-time OpenRouter call). Storing a URL directly would mean storing something that's either redundant (portraits, since it's a pure function of the path) or actively wrong the moment it's read back (references, since a stored "URL" would imply a permanence the object was specifically designed not to have).
- No fallback-model retry on a failed image generation call (unlike text calls, which retry against a fallback model) — a manual, cost-incurring action should surface a failure to the person rather than silently spend twice trying to route around it.
- `GCS_BUCKET_NAME` is an optional env var defaulting to the real bucket's actual name (`bedtime-prod-storage`) — no new required secret in production or CI.
- `@google-cloud/storage` and `multer` (pinned `^2.2.0`, the current stable major — verified via the npm registry) live in `packages/api/package.json`, not `packages/core` — mirrors the existing `@google-cloud/tasks` precedent (GCP/Express SDKs stay in the API package); core exposes a small `ObjectStorage` interface and receives an implementation via dependency injection, the same shape as the existing `Queue` and `CostRecorder` interfaces.
- **Revised mid-planning at the product owner's request**: generated portraits are tracked in their own `character_portraits` table (current + up to 3 previous, oldest pruned beyond that) rather than the first draft's 3 nullable columns on `universe_characters` with no history at all. See Data model changes for the full reasoning.
- The previous-portraits history is exposed in the UI as a read-only thumbnail strip (view only, no "restore this one" action) — the product owner's own framing was that keeping history nobody can see is low value, but restoring an old portrait back to current is meaningfully more work (it has to re-enter the same current/previous rotation, including what happens to whatever was current at that moment) and wasn't asked for; a natural follow-up if it turns out to matter in practice.
- `model_calls.character_id` is added nullable, alongside the existing nullable `story_id` — a portrait call has a character but no story.
- Deleting a character now cascades — in application code, not a DB-level `ON DELETE CASCADE` — through its reference images, portraits (current and previous), and cost-tracking rows, mirroring how `delete-story-cascade.ts` already deletes (not nulls) a story's own related rows elsewhere in this app. Without this, the very first character anyone attaches an image to would become permanently undeletable on a plain foreign-key violation — caught during planning by an independent red-team pass, not in the original draft.
- Reference uploads are capped at 5 files per request, 8MB per file, `image/png`/`image/jpeg`/`image/webp` only — enforced via multer. No hard cap on total references per character (low-volume personal app; manual uploading is its own natural limit).
- Sibling portraits for tier 2 are selected most-recently-generated-first, capped at 3, and explicitly exclude the character currently being generated — without that exclusion, a character regenerating with no references of its own could pick up its own previous portrait as a "sibling" reference, which would work but mislabel itself.
- Deleting a single reference image, or a portrait that's aged out of the 3-previous retention window, does not delete the underlying GCS object — bucket versioning already covers recovery, and storage cost at this scale is negligible.
- The app's own bundled default-style-reference asset (currently 3.4MB, ~4.5MB once base64-encoded) is re-saved at a smaller resolution as part of this work — it's the reference every brand-new universe's first character hits, so an oversized payload here is the worst possible place for a size-related surprise. Downscaling loses nothing an art-style-only reference needs.
- The "Generate portrait" button shows a confirmation before firing, matching this UI's existing delete-confirmation pattern — a real-money action gets the same friction the app already applies to a destructive one.
- New route files (`universe-character-reference-images.ts`, `universe-character-portrait.ts`, `delete-character-cascade.ts`) rather than extending the already-349-line `universes.ts`, per this repo's own under-300-lines file-size convention.
- Local Docker dev needs Google Application Default Credentials to exercise the upload/generate endpoints — documented as a one-time manual setup step; not enforced as a required env var, so the rest of the app keeps working locally without it.

### Implementation order

1. Downscale `default-character-style-reference.png` to ~1024px on the long edge, re-export in place
2. `buildCharacterAssetPath` — deriver, red-green-refactor (top-level `references/`/`portraits/` prefixes)
3. `buildPublicObjectUrl` — deriver, red-green-refactor
4. `validateReferenceUpload` — deriver, red-green-refactor
5. `deriveReferenceTier` — deriver, red-green-refactor, covers SCENARIO 2, 3, 4, 5
6. `buildPortraitPrompt` — deriver, red-green-refactor, covers SCENARIO 2, 3, 4
7. Schema migration: `characterReferenceImages` table, `characterPortraits` table, `modelCalls.characterId` — generate + apply via `npm run db:migrate`
8. `cost-recorder.ts` — extend `RecordCallInput`/insert with `characterId`
9. `object-storage.interface.ts` (core: `upload`/`getSignedReadUrl`/`delete`) + `gcs-object-storage.ts` (api,
   dynamic-imports `@google-cloud/storage`, `getSignedReadUrl` via `file.getSignedUrl({ version: 'v4', ... })`)
10. `openrouter.client.ts` `generateImage()` — hits `POST /images`
11. `openrouter.runner.ts` `generateImage()` — wires client + cost recorder + langfuse + the model_catalog pre-flight check, covers SCENARIO 8, 9, 10 (server side)
12. `load-portrait-candidates.ts` (excludes self from siblings) + `load-characters-with-portrait.ts` — DB reads, return storage paths only, covers SCENARIO 3
13. `save-reference-image.ts` + `generate-portrait.ts` — orchestration including per-tier reference resolution
    (sign own-references fresh, build public URLs for siblings, base64 the default asset) and the
    current/previous retention rotation, covers SCENARIO 1, 2, 4, 5, 6, 8, 9
14. `delete-character-cascade.ts`, wired into `universes.ts`'s existing character DELETE route — covers SCENARIO 11
15. `universe-character-reference-images.ts` (signs on POST and GET) + `universe-character-portrait.ts` routes
    (incl. portrait-history GET), mount in `server.ts`
16. `universes.ts`'s `toPublic()`/`GET /:id/characters` switched to `load-characters-with-portrait.ts` +
    `build-public-object-url.ts`
17. `packages/web/src/lib/api.ts` — types, `requestFormData`, new `api.universes.*` methods
18. `character-reference-images.tsx` + `character-portrait-panel.tsx` (incl. previous-portraits strip), wired into `universe-characters.tsx`, covers SCENARIO 1, 5, 6, 7, 10 (client side)
19. `infra/index.ts` — bucket-scoped `objectAdmin` for `apiSa`, condition-scoped `objectViewer` for `allUsers`
    on `portraits/` only, and `apiSa`'s self-impersonation `serviceAccountTokenCreator` binding — ships via
    the existing CI Infra job on push to `main`
20. Documentation: `docs/architecture/06-character-portraits.md` (+ diagrams/img), update `01-system-overview.md`, `05-data-model.md`, `README.md`, `docs/ci-cd/local-dev.md`, `.env.example`

### Scope boundary

- No wiring into the story reader, story cards, or any story-illustration feature — this is character base-image asset management only, inside the universe/character management UI.
- History is capped, not unlimited — 1 current + up to 3 previous portraits per character; older ones are only recoverable through GCS bucket versioning, same as before this table existed.
- No "restore a previous portrait to current" action — the strip is view-only for this pass (see Decisions).
- No automatic/triggered generation on character create or edit — manual button only, every time.
- No restore/rollback for a *reference* image once deleted — same as before, only the DB row goes away, deliberately, and there's no undo UI for that either.
- No background refresh of a reference-image thumbnail's signed URL — it re-signs on next fetch, not proactively before expiry (see Decisions).
- No total-count cap on reference images per character, only a per-upload-request cap.
- No spend cap or running-cost display across repeated regenerations of the same character — matches how the rest of this app has no per-feature spend caps anywhere; the existing `model_calls` table already makes cost auditable after the fact, the same way every other pipeline stage's cost already is.
