---
date: 2026-04-19 14:00
skill: project-manager
batch: hierarchy-fix
---

## What I processed
User instruction: every Story and Task must live under both an Initiative AND an Epic (not directly under an Initiative).

## Decisions made
- Found 20 items directly parented to an Initiative (skipping Epic layer).
- Created 6 new Epics to fill the gap:
  - #278 [Epic] Pipeline monitoring and logs → under #251 Pipeline observability (priority:high)
  - #279 [Epic] AI instruction lifecycle → under #251 Pipeline observability (priority:medium)
  - #280 [Epic] Error handling and recovery → under #252 Pipeline resilience (priority:high)
  - #281 [Epic] Usage limits and budget controls → under #252 Pipeline resilience (priority:medium)
  - #282 [Epic] Accessibility → under #256 Reliable product delivery (priority:lowest)
  - #283 [Epic] Developer documentation → under #256 Reliable product delivery (priority:low)
- App Health Check (#53) folded into Pipeline monitoring and logs (user said no separate Epic).
- Keyboard Navigation Support (#48) moved from Pipeline resilience to Accessibility (priority:lowest per user).
- All 20 stories/tasks successfully re-parented to their new Epics.
- Verified: no Story or Task remains directly under an Initiative.

## Open questions
None — hierarchy is now complete.

## Items skipped
None.
