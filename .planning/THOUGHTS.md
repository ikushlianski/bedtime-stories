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

---
date: 2026-04-21 00:00
skill: project-manager
batch: status-audit-full
---

## What I processed
User request: audit all 283 items in Project #13 against the codebase and set statuses to reflect reality. Reopen any closed issues found. If fully implemented → close issue + set Done. If partially implemented → narrow scope of existing issue, keep in Backlog. If not implemented → Backlog.

## Decisions made
- Reopened 14 previously-closed issues: #271, #270, #255, #248, #228, #225, #205, #203, #202, #198, #28, #17, #14, #2.
- Closed 39 fully-implemented issues and set their project status to Done: #17, #28, #47, #82, #90, #100, #101, #102, #106, #124, #125, #130, #131, #135, #136, #137, #140, #141, #142, #143, #145, #146, #147, #152, #154, #155, #159, #168, #175, #178, #184, #185, #186, #187, #191, #202, #203, #205, #284.
- Set 142 items with missing status to Backlog (issues #93–#277 range minus Done set).
- Items #1–#92, #249–#256, #278–#285 were already in Backlog; left as-is.
- Partial items (#166, #167, #188, #119) left in Backlog as open work — no splits created because the "done portions" are negligible/incidental and don't merit separate tracking.
- No items remain in Todo status (per user directive that Todo should be empty after audit).

## Key findings from codebase audit
- Pipeline status is in-memory only (Maps in pipeline-state.ts) → #166 and #167 remain open.
- Universe context is looked up dynamically at generation time, not snapshotted → #188 remains open.
- Dashboard analytics are all "coming soon" stubs → all dashboard Epics/Stories remain open in Backlog.
- diary.tsx has no edit functionality → #182 remains open.
- pipeline-status.tsx has empty onerror handler → #172 remains open.

## Open questions
None.

## Items skipped
None.
