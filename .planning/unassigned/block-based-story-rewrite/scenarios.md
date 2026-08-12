---
type: scenarios
branch: content-ux-fixes-aug12
task: Block-based story rewrite — let the parent rewrite one paragraph at a time via chat instead of regenerating the whole story
state: confirmed
updated: 2026-08-12
---
# Scenarios: Block-based story rewrite

## Business Scenarios

SCENARIO 1: Parent sees the story broken into rewriteable blocks

On the text-review page, the story text renders as individual paragraph blocks, each with a small always-visible rewrite control next to it.

What to verify:
- Every non-blank line of the current text renders as one block with a visible rewrite icon
- Blank lines still render as paragraph spacing exactly as before (no visual regression)
- Block boundaries come from the same text driving free-hand selection — no second, divergent copy of the story text

SCENARIO 2: Parent requests a rewrite of exactly one block

Clicking the rewrite icon on a block opens the same chat panel already used for manual-selection edits, pre-scoped to that block's exact text — no new UI surface, no free-hand mouse selection required.

What to verify:
- The opened chat panel shows the block's text as the "selected fragment," identical UX to today's manual-selection flow
- The AI's proposed patch is diffed only against that block's text, not the whole story
- Applying the patch calls the existing `apply-text-patch` endpoint with `find` = the block's exact text — no new endpoint, no new request shape

SCENARIO 3: Parent iterates across multiple blocks before approving

After applying a block patch, the page reloads the story text and blocks re-derive from the new text; blocks the parent hasn't touched are untouched.

What to verify:
- Each applied block patch creates a new `chat_patch` story text version (existing behavior) — so a single block's edit is individually restorable via `TextVersionHistory` without reverting the other blocks
- Editing block N does not require re-sending or re-approving any other block
- The mutation gate (`resolveChatGate`) behaves exactly as it does today — draft/proofreading editable, ready/read/archived blocked — unchanged by this feature

SCENARIO 4: Parent finishes and finalizes the whole story

Once satisfied with all blocks, the parent clicks the existing "Готово для Саши" approve button. There is no separate "lock in all blocks" step.

What to verify:
- `approveText` is unchanged and remains the one terminal action
- No new finalize/lock endpoint or story status is introduced by this feature

SCENARIO 5 (edge case): Duplicate paragraph text

Two blocks happen to contain byte-identical text (e.g. a repeated short line). Requesting a rewrite on either one performs a find/replace that — like today's manual-selection flow — matches and replaces only the first occurrence in the full text.

What to verify:
- No new failure mode is introduced beyond what free-hand selection already has today for repeated substrings
- This is an accepted, pre-existing limitation (see spec.md "Decisions made autonomously"), not something this feature silently "fixes" with new disambiguation logic

SCENARIO 6 (edge case): Empty or blank-only text

A story whose current text is empty, or contains only blank lines, renders zero blocks.

What to verify:
- The block-splitting function returns an empty list for `''` and for whitespace-only input
- No rewrite buttons render, and the page does not crash or show a broken block

## Technical/Architectural Scenarios

None — this is a frontend-only change layered on an existing, unmodified backend contract (`apply-text-patch`, `conversations`, `resolve-chat-gate`, `story_text_versions`). See spec.md for why no backend change is needed.
