---
type: todo
branch: main
task: story illustration album
state: open
updated: 2026-08-22
---
# Todo: story illustration album

## Decisions to make
Nothing left to decide before implementation starts — the marker cap (6), the "manual marks fill their own slots, automatic fills the rest" branching (confirmed by the coordinator — see Resolved), and every other reversible choice are logged in spec.md's "Decisions made autonomously".

## To review / clarify
Nothing open — the one item that was here (how manual marks interact with the automatic count) was confirmed by the coordinator; see Resolved below.

## Coding tasks
- [x] buildStoryIllustrationAssetPath deriver + test (top-level illustrations/ prefix)
- [x] matchCharacterNamesToCast deriver + test (automatic path, case-insensitive exact match)
- [x] detectCastMembersInText deriver + test (manual path, plain substring search, no model call)
- [x] validateMarkerLimit deriver + test (cap at 6)
- [x] buildIllustrationPrompt deriver + test (identity-vs-style separation, mirrors buildPortraitPrompt's pattern)
- [x] Extract load-default-style-image.ts out of generate-portrait.ts (behavior-identical move, red-green-refactor)
- [x] RunImageOptions.storyId + openrouter.runner.ts generateImage() threading it into both recorder.record() calls
- [x] per-stage-models.ts + stage-defaults.ts: add illustrationMomentSelector stage (cheap tier, same as ideaSuggester)
- [x] story-illustration-moments.md skill file (Russian, exactly 2 moments + character names)
- [x] select-illustration-moments.ts pipeline stage wrapper (mirrors story-analyzer.ts)
- [x] load-story-cast.ts (merges cast + portrait status across every universe a story is linked to)
- [x] Schema migration: story_illustrations, story_illustration_markers
- [x] story-illustration-markers.ts routes (POST/GET/DELETE, enforces validateMarkerLimit + 2000-char cap)
- [x] generate-illustration-album.ts orchestration (marks-vs-automatic branching, Promise.allSettled, force option)
- [x] story-illustration-trigger.ts fire-and-forget wrapper (mirrors triggerAnalysis)
- [x] pipeline-dispatch.ts dispatchIllustrationAlbum + internal-worker.ts POST /illustrations
- [x] Wire dispatch into stories.ts's 4 ready-writing sites (approve-text, both creation branches, PATCH status)
- [x] delete-story-cascade.ts: delete story_illustrations + story_illustration_markers rows
- [x] story-illustrations.ts routes (GET, POST /regenerate), mount both new routers in server.ts
- [x] api.ts: StoryIllustration/StoryIllustrationMarker types, new api.stories.* methods
- [x] annotation-toolbar.tsx: new mark-for-illustration action, disabled state once at cap
- [x] story-illustration-markers-panel.tsx + wiring in story-reader.tsx
- [x] story-illustration-gallery.tsx (thumbnail row + paged lightbox + regenerate button) + wiring in story-reader.tsx
- [x] docs: story-illustration-album.md + diagrams/img, update 04-feedback-and-review.md, 05-data-model.md, README.md

## Manual steps
- [ ] Confirm google/gemini-2.5-flash-image is still present in model_catalog (already relied on by the shipped character-portrait feature; the code-level pre-flight guard in openrouter.runner.ts already protects against a gap either way)

## Post-deploy checks
- [ ] Approve a real story with no marks, confirm exactly 2 illustrations appear within ~1 minute and cost rows show stage=illustrationMomentSelector + stage=story_illustration with story_id set
- [ ] Mark 2-3 passages on a story before it's ready, approve it, confirm the album illustrates exactly those marks and no automatic moment-selection cost row was recorded
- [ ] Mark a 7th passage on a story already at the cap, confirm it's rejected with a clear reason
- [ ] Generate an album for a story whose cast includes one character with an existing portrait and one without, confirm the portraited character is recognizable and consistent
- [ ] Re-run "ready" transition twice for the same story (e.g. via the status PATCH route), confirm no second album/charge
- [ ] Delete a story with an album and marks attached, confirm it succeeds and nothing orphaned remains
- [ ] Use the manual "regenerate album" action, confirm old rows are replaced (not appended) and current marks (if any) are respected
- [ ] npx tsc --noEmit clean, npx vitest run green before any commit
- [ ] Migration applied via npm run db:migrate, not drizzle-kit migrate directly

## Resolved
- 2026-08-22: Coordinator confirmed the manual-mark/automatic-count interaction ("ручные + авто дозаполнение"): manual marks fill their own slots first; the automatic moment-picker fills only whatever slots remain up to the target of 2 (0 remaining when marks already meet or exceed the target, so the automatic call is skipped entirely in that case). This is the opposite of this plan's original draft, which had marks fully replacing the automatic picker with no fill-in — spec.md, scenarios.md, and architecture.md were all updated to match, including a new SCENARIO 16 for the "1 mark + 1 auto-filled" mixed case and a regenerated architecture diagram.
- 2026-08-22: Verified all four code paths that can set stories.status = 'ready' by reading every write site in the codebase (approve-text route, two branches of story creation, generic PATCH status route) — dispatch is wired to all four, not just approve-text.
- 2026-08-22: Verified the offline notion-import.ts script writes ready-status rows directly to the DB, bypassing every API route — deliberately left unwired to avoid an unbounded bulk-import cost surprise.
- 2026-08-22: Verified against the real provisioned Pulumi source (infra/index.ts) that the public storage bucket's public-read grant is bucket-wide, not scoped to a portraits/-only prefix as the character-portrait plan originally intended — no infra change needed for the new illustrations/ prefix.
- 2026-08-22: Found a substantial, unmerged prior attempt at a similar feature (story-images branch/worktree, never merged) predating the character-portrait feature's storage/OpenRouter rework — not reused; flagged for a human decision on whether to delete it.
- 2026-08-22: Confirmed the reading page's text-selection/annotation mechanism (SelectionState + AnnotationToolbar) is already active at every story status, not gated to proofreading only — manual marking reuses it as-is rather than building a separate selection UI.
