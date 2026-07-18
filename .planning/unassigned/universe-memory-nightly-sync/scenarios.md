---
type: scenarios
branch: universe-memory-nightly-sync
task: Turn universe memory into a persistent, nightly-synthesized store fed by all feedback
state: confirmed
updated: 2026-07-18
---
# Scenarios: Universe memory nightly sync

## Business Scenarios

SCENARIO 1: Nightly sync folds in a day's feedback automatically

A parent rates two stories, adds an annotation, and fills in a child reaction across a universe during the day, without approving or marking any story as read. That night, the sync runs on its own and the universe's memory reflects all of it the next morning.

What to verify:
- The sync runs on a schedule, not only as a side effect of a story being approved or marked read.
- All four feedback sources (ratings, annotations, parent reviews, child reactions) left since the last sync are considered, not just ratings/annotations.
- The universe's memory (style guide fields) after the run reflects the new feedback.

SCENARIO 2: A quiet universe is left untouched

A universe had its memory synced last night. No new feedback was left on any of its stories today. Tonight's sync runs again.

What to verify:
- No LLM call is made for that universe (nothing new to fold in).
- The universe's stored memory fields and last-synced marker are unchanged — running twice with nothing new is a true no-op, not a re-summarization that could drift the text.

SCENARIO 3: First-ever sync for an established universe

A universe has been accumulating stories and feedback for weeks but has never had a nightly sync run (e.g. it predates this feature, or was never manually regenerated). The nightly job reaches it for the first time.

What to verify:
- The sync treats "never synced" as "everything in the existing bounded window is new" and builds an initial memory from it, the same bounded window (last 50 ready/read stories) already used today — no unbounded full-history scan.
- After this first run, the universe has a last-synced marker so the next run only looks at what's new since tonight.

SCENARIO 4: Manual "regenerate memory" button behaves like the nightly job

A parent has the existing manual regenerate action available (`POST /universes/:id/synthesize-memory`) and triggers it mid-day instead of waiting for the nightly pass.

What to verify:
- The manual trigger uses the same accumulating logic as the nightly job (merges with existing memory, does not blank it and rebuild from scratch).
- If there is no new feedback since the last sync, the manual trigger reports that plainly instead of silently succeeding with unchanged data.

SCENARIO 5: Marking a story as read still triggers an immediate sync, now accumulating

A parent finishes reading a story and marks it read. The existing on-read trigger fires immediately (unchanged trigger point).

What to verify:
- The immediate sync uses the same accumulating function as the nightly job — it merges with the current memory rather than overwriting it, closing the inconsistency where this path used to blank out anything the nightly-style logic doesn't also produce.
- This does not require the nightly job to skip that universe later — if new feedback arrives after the on-read sync, that universe is picked up again on the next scheduled run.

SCENARIO 6: One universe's failure doesn't block the rest of the nightly batch

During a scheduled run, the LLM call for one universe fails (timeout, malformed output, etc.).

What to verify:
- The batch continues processing the remaining universes.
- The failure is logged with enough detail to find it later (universe id, error).
- The failed universe's memory and last-synced marker are left as they were before the failed attempt — no partial or corrupted write.

SCENARIO 7: All four feedback sources show up in the synthesized memory

A universe has a story with a parent review (rating + notes), another story with a child reaction (favorite character, was scary), a third with a free-text annotation, and a fourth with generic feedback (rating + comment). All four are new since the last sync.

What to verify:
- The prompt sent to the LLM includes content derived from all four tables, not just feedback + annotations as before.
- The synthesized `works` / `doesntWork` / `techniques` / `minimize` sections can plausibly reflect signal from any of the four sources — the request doesn't require exact attribution of which line came from which table.

## Technical/Architectural Scenarios

SCENARIO 8: Internal sync endpoint rejects unauthenticated calls

Something calls `POST /api/internal/universe-memory-sync` without the correct secret header.

What to verify:
- The request is rejected with 401 before any universe is touched, matching the existing `catalog-sync` and `worker` internal-endpoint pattern.

SCENARIO 9: Overlapping syncs on the same universe don't corrupt state

The nightly job and a manual "regenerate" click both touch the same universe close together (rare, but possible on a personal app with no locking).

What to verify:
- Each run's persistence is a single row update (fields + compiled guide + last-synced marker together) — the outcome is "last write wins" with a fully consistent set of fields, never a mix of one run's sections with another run's timestamp.
- This is an accepted limitation (no distributed lock introduced) given the single-family, low-concurrency usage of this app — noted explicitly so it isn't mistaken for an oversight.
