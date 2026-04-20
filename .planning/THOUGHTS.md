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

---
date: 2026-04-20 12:00
skill: project-manager
batch: followup-questions-feature
---

## What I processed
User request: capture the multi-round clarifying-questions feature into Project #13. Not from a PRD file — direct discussion. Architecture agreed: no separate evaluator agent; Plotter returns discriminated-union output (plan OR follow-up questions) with a hard 2-round cap enforced in prompt + code.

## Decisions made
- Created single Story #284 `[Story] Follow-up clarifying questions when needed` under Epic #259 `[Epic] Story planning flow` (Initiative #249).
- Priority: medium (label) / P1 (project field). Quality-of-output lift, not MVP blocker.
- Size: M.
- Labels: type:story, priority:medium, source:ai.
- Did NOT create a separate Task for the routing/state invariant or the 2-round cap — they are how the Story manifests, codified in the acceptance criteria in the body.
- Repo: ikushlianski/bedtime-stories (different from default football-score-simulator; used inline gh calls instead of scripts/create-issue.sh).
- Project 13 uses P0/P1/P2 priority options, not Urgent/High/Medium/Low/Lowest — mapped medium → P1.

## Open questions
None.

## Items skipped
None — no existing duplicate for multi-round/follow-up questions in Project #13.
