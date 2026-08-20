---
type: todo
branch: main
task: character base/portrait images
state: open
updated: 2026-08-21
---
# Todo: character base/portrait images

## Decisions to make
Nothing to decide — business behavior, model/provider, storage, and infra approach were pre-decided; remaining reversible choices are logged in spec.md's "Decisions made autonomously".

## To review / clarify
Nothing to review — the reference-image privacy question was resolved by the product owner (see Resolved).

## Coding tasks
- [ ] Downscale default-character-style-reference.png to ~1024px before use (currently 3.4MB)
- [ ] buildCharacterAssetPath deriver + test (top-level references/ vs portraits/ prefix)
- [ ] buildPublicObjectUrl deriver + test
- [ ] validateReferenceUpload deriver + test
- [ ] deriveReferenceTier deriver + test (covers own-ref, sibling, default tiers)
- [ ] buildPortraitPrompt deriver + test
- [ ] Schema migration: character_reference_images, character_portraits, model_calls.character_id
- [ ] Extend cost-recorder RecordCallInput with characterId
- [ ] ObjectStorage interface (core: upload/getSignedReadUrl/delete) + GcsObjectStorage impl (api, dynamic-imports @google-cloud/storage)
- [ ] OpenRouterClient.generateImage() hitting POST /images
- [ ] OpenRouterRunner.generateImage(): client + cost recorder + langfuse + model_catalog pre-flight guard
- [ ] load-portrait-candidates.ts (own refs, sibling portraits excluding self, capped/ordered, returns paths)
- [ ] load-characters-with-portrait.ts (join helper for existing character-list endpoints)
- [ ] save-reference-image.ts + generate-portrait.ts (sign own-refs, public-URL siblings, retention rotation)
- [ ] delete-character-cascade.ts, wire into universes.ts's character DELETE route
- [ ] universe-character-reference-images.ts (signs on POST+GET) + universe-character-portrait.ts routes
- [ ] Switch universes.ts toPublic()/GET characters to load-characters-with-portrait.ts + buildPublicObjectUrl
- [ ] api.ts: types (CharacterReferenceImage.url is signed, not raw path), requestFormData, new universes.* methods
- [ ] character-reference-images.tsx + character-portrait-panel.tsx (incl. previous-portraits strip)
- [ ] infra/index.ts: apiSa objectAdmin, allUsers objectViewer scoped to portraits/ only via IAM condition, apiSa serviceAccountTokenCreator self-binding
- [ ] docs: 06-character-portraits.md + diagrams/img, update 01/05/README, local-dev.md, .env.example

## Manual steps
- [ ] Confirm google/gemini-2.5-flash-image exists in model_catalog after first deploy (nightly sync should cover it; the code-level pre-flight guard is what actually protects against a gap)
- [ ] Configure local GCP Application Default Credentials to exercise upload/generate in Docker dev

## Post-deploy checks
- [ ] Verify apiSa's bucket IAM bindings and self-impersonation binding applied (CI Infra job ran on push to main)
- [ ] Confirm a references/ object is NOT publicly fetchable without a signed URL (curl the raw storage URL, expect 403)
- [ ] Generate one real portrait per fallback tier against production data, confirm cost row recorded
- [ ] Generate a 4th portrait for one character, confirm only 3 previous ones remain
- [ ] Delete a character with references + portraits attached, confirm it succeeds
- [ ] npx tsc --noEmit clean, npx vitest run green before any commit
- [ ] Migration applied via npm run db:migrate, not drizzle-kit migrate directly

## Resolved
- 2026-08-21: Verified OpenRouter POST /images contract live (curl, real API key) — response shape and usage.cost field match documentation exactly; real cost was ~$0.039 for one plain-prompt call.
- 2026-08-21: Verified multer's current stable line is 2.x (2.2.0) via npm registry, not 1.x.
- 2026-08-21: Portrait retention redesigned from "current only, 3 columns on universe_characters" to a dedicated character_portraits table (1 current + up to 3 previous) per product owner request.
- 2026-08-21: Reference-image privacy resolved by product owner — private, signed URLs only; portraits stay public. Verified GCS IAM Condition prefix syntax and self-impersonation signing requirement against Google's docs.
