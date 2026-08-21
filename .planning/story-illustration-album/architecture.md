---
type: architecture
branch: main
task: story illustration album
state: confirmed
updated: 2026-08-22
---

# Architecture: story illustration album

## What changes structurally

The API gains a new background side-effect that fires whenever a story's status genuinely transitions into "ready" — mirroring how story analysis already fires the same way after approval, but wired to every place that write can happen, not just one. That side-effect chains two existing outbound integrations rather than adding new ones: a cheap text call picks two vivid moments and their characters from the finished story, then parallel calls to the same image-generation integration character portraits already use turn those moments into pictures, using any character's existing portrait as an identity reference and the app's shared style asset as the art-style anchor. Results land in the same public storage bucket portraits already use, under a new path prefix, plus one new database table. A manual "regenerate album" action reuses the exact same orchestration on demand, forcing a fresh run instead of skipping because one already exists.

A second, independent addition sits upstream of all of that: the reading page's existing text-selection mechanism (already used to attach reactions and notes to a highlighted passage) gains one more action — marking a passage as "illustrate this." Marks are stored in their own table, structurally separate from both the story's narrative text and every other annotation type, and are freely addable/removable at any time. Whenever the album orchestrator runs — automatically on becoming ready, or manually via regenerate — it illustrates every existing mark first, then computes how many slots remain up to the fixed target of two and asks the automatic picker for exactly that many (passing the marks' own text along so it doesn't duplicate what's already covered). Once marks alone reach the target, the automatic picker isn't called at all; with no marks, the automatic picker fills both slots exactly as before.

![architecture diagram](./architecture-diagram.png)

## New infrastructure

None. The new illustration objects are stored in the same public bucket portraits already use, under a new top-level prefix. That bucket's public-read grant was verified against the actual provisioned infrastructure (not just the earlier portrait feature's plan) to be bucket-wide rather than scoped to the portraits prefix — a deliberate deviation made when the originally-planned prefix-scoped condition turned out to be incompatible with a public grant on Google's side. The new prefix is covered automatically, with no IAM change required.

## Data model evolution

- A new table holds one row per generated illustration, many-to-one against a story, each recording which scene it depicts, which cast members it was asked to include, and whether it came from the automatic picker or a manual mark — up to a handful of rows per story, fewer if some failed, replaced wholesale (not appended to) on a manual regenerate.
- A second new table holds one row per manually marked passage, many-to-one against a story, independent of and never merged into the story's own narrative text field or into the existing free-form annotations table — this separation was an explicit product requirement, not just a modeling preference, so a marked passage can never leak into anything that reads the story's general text or its unrelated reaction/note history.
- No change to the existing per-call cost-tracking table's shape — it already carries an optional story reference, which both the automatic moment-selection call and each image call attribute their cost to; the character-attribution field that table already has for portraits is left null here, since one illustrated moment can span several characters at once and this table only attributes a call to one thing.
- Deleting a story now also removes its illustration records and any marked passages, mirroring how deleting a story already cascades through every other story-owned table.

## Failure modes

- The automatic moment-selection call fails: whatever marks already exist are still illustrated (that part of the run doesn't depend on this call), only the automatically-filled slots are missing from the resulting album — same "partial album shown as-is" handling as any other partial failure. If the story has no usable text at all, no illustrations are attempted from either source and nothing is billed — illustration is a layer on top of a finished story, never a precondition for it.
- One or more image calls fail while others succeed: the ones that succeeded are kept and shown; failures are not retried automatically. A visible manual re-run exists for a person to complete or redo the set later, deliberately choosing not to auto-retry so a systemic problem (e.g. a rate limit) doesn't quietly turn one failed run into several billed ones.
- Running the image calls in parallel rather than one after another trades a small increase in the chance any single one gets rate-limited against a large reduction in how long the story's owner waits for the background result — accepted deliberately, since a rate-limited call simply becomes a missing picture in an otherwise-complete album, not a blocked story.
- The step that identifies which characters appear in a moment (automatic) or a marked passage (a plain name search, no model call) occasionally misses or misattributes a name. The moment or mark is illustrated regardless; that one mismatched name is simply not used as an identity reference, since a wrong identity reference would be worse than none.
- A story that already has an album has its "ready" status set again by some other path: the background step recognizes an album already exists for that story and skips entirely, so the same story is never billed for a second automatic album — only the manual regenerate action is allowed to intentionally replace an existing album.
- A story is sent back for rewriting and later re-approved after already having an album, or its marks are changed after the fact: the existing album is left in place rather than automatically refreshed — refreshing it is a manual action, not automatic, since detecting exactly how much a rewrite or a mark change should invalidate the existing album would add real complexity for what is an uncommon path.
- A person keeps adding marks indefinitely: capped at a small fixed number per story, enforced before the mark is created, so hand-marking can never build an unboundedly expensive album.

## Rollout

- No infrastructure change ships with this feature (see above) — nothing beyond the existing CI test-then-deploy pipeline.
- The database migration runs via this repo's existing migration script, applied the same way every prior migration in this repo has been.
- No new environment variable or secret is required — the feature reuses the storage bucket name, image model, and OpenRouter credentials the character-portrait feature already configured.
- This is a genuinely new recurring cost, unlike the manual-only portrait feature it builds on: every story that becomes ready to read now costs roughly the price of two generated images, automatically, with no per-story confirmation step (the automatic trigger was a deliberate product decision, not an oversight) — worth watching if story throughput or bulk-import volume increases materially. A story with two or more marks costs only the price of however many images were marked (capped at six), with no text-call overhead at all, since the automatic picker isn't called once marks alone meet the target.
