---
type: spec
branch: content-ux-fixes-aug12
task: Block-based story rewrite — let the parent rewrite one paragraph at a time via chat instead of regenerating the whole story
complexity: medium
state: confirmed
updated: 2026-08-12
---
# Spec: Block-based story rewrite

### Summary
The parent currently only has a whole-story chat box at the bottom of the text-review page, plus a free-hand mouse-selection popover for pinpoint edits. This adds a lightweight, explicit "rewrite this paragraph" affordance on every paragraph of the story text, wired to the exact same chat/patch mechanism the mouse-selection flow already uses. A block is simply a non-empty line of the story's current text — no new markers, no change to what the Writer stage emits, no schema change, no new endpoint. The parent can now rewrite one paragraph, see it applied and versioned, move to the next, and repeat until happy — then approve the story exactly as before.

### Implementation Phases
Single phase implementation.

### Derivers
| Deriver | Inputs | Output | Scenarios covered |
|---|---|---|---|
| `splitTextIntoLines` | raw story text (`string`) | ordered list of `{ index, text, isBlock }` — one entry per `\n`-delimited line, `isBlock` false for blank/whitespace-only lines | SCENARIO 1, SCENARIO 6 |
| `splitTextIntoBlocks` | raw story text (`string`) | ordered list of `{ index, text }` for non-blank lines only (derived by filtering `splitTextIntoLines`) | SCENARIO 1, SCENARIO 6 |

### Files by scenario
| Scenario | Backend files | Frontend files | Infrastructure files |
|---|---|---|---|
| SCENARIO 1 | None | `packages/web/src/pages/text-blocks.ts` (new), `packages/web/src/pages/text-review.tsx` (render blocks + rewrite icon) | None |
| SCENARIO 2 | None (existing `apply-text-patch` / `conversations` endpoints reused unchanged) | `packages/web/src/pages/text-review.tsx` (wire rewrite icon to existing `onChatAboutThis` callback) | None |
| SCENARIO 3 | None (existing `story_text_versions` + `chat_patch` stage reused unchanged) | None beyond SCENARIO 1/2 changes — `TextVersionHistory` already renders per-version restore | None |
| SCENARIO 4 | None | None — existing `handleApprove` / "Готово для Саши" button unchanged | None |
| SCENARIO 5 | None | Documented limitation only, no code change | None |
| SCENARIO 6 | None | `packages/web/src/pages/text-blocks.ts` (empty/blank input handling) | None |

### Files to create
```
packages/web/src/pages/
├── text-blocks.ts        # splitTextIntoLines / splitTextIntoBlocks — pure, no React
└── text-blocks.test.ts   # vitest coverage for both functions
```

### Files to modify
```
packages/web/src/pages/
└── text-review.tsx   # TextAnnotationPanel: render via splitTextIntoLines instead of raw
                       # text.split('\n'); each non-blank line gets a small rewrite
                       # button calling the existing onChatAboutThis(line.text) callback.
                       # Free-hand mouse selection (existing popover) is untouched —
                       # this is additive, not a replacement.
```

### Data model changes
Not applicable — no schema, migration, or new column. `story_text_versions.stage = 'chat_patch'` already exists and is reused as-is for block-scoped patches, identical to how it's already used for manual-selection patches.

### Documentation changes
No documentation changes required — this is a UI-layer addition on top of an already-documented chat/patch mechanism (`story-chat-panel.tsx`, `apply-text-patch`); no architectural shift, no new domain, no new component boundary.

### Decisions made autonomously
- **A "block" is a non-empty line of `text.split('\n')`, not a new structural marker the Writer emits.** — Matches the Writer's actual output shape (one line per paragraph, blank lines as spacers, already relied on by both `story-reader.tsx` and `text-review.tsx`); avoids touching the Writer prompt/output contract entirely, which the task explicitly flagged as the preferred default.
- **Block-scoped rewrite reuses the existing `selectedText` chat/patch mechanism verbatim (same `applyTextPatch`, same `<<<PATCH>>>` parsing, same `computePatchedText` find/replace) instead of a new "block id" concept.** — The backend already has zero knowledge of how `selectedText` was chosen (mouse selection vs. anything else); introducing a block-id-based endpoint would duplicate an existing, working contract for no behavioral gain.
- **No new "finalize all blocks" endpoint or story status.** — Every block patch already lands as a new `chat_patch` text version, and the existing "Готово для Саши" approve action is already the terminal step once the parent is satisfied; adding a second finalize concept would be a distinction without a difference.
- **Rewrite affordance is always-visible per block (small ghost icon button), not hover-reveal.** — Hover-only controls are unreliable on touch devices, and a concurrent agent is independently doing mobile-CSS work on nearby pages this task must not collide with; an always-visible small control needs no responsive/hover tuning to be usable.
- **Free-hand mouse-selection commenting stays exactly as-is, unchanged.** — It already supports finer-than-paragraph edits (a clause, a sentence); blocks are additive convenience for the common case, not a replacement for it.
- **Duplicate-paragraph find/replace ambiguity (SCENARIO 5) is accepted, not solved.** — `computePatchedText` already has this exact limitation for manual selection today; solving it would require a new addressing scheme (e.g. block index sent to the backend) that the task's own guidance discourages ("simplicity ... is preferred if it gets the job done"). Flagged here for future consideration, not silently patched over.
- **Plan folder written under `.planning/unassigned/` and `spec.md`/`scenarios.md` self-confirmed rather than left in `draft`.** — This is an unattended overnight run with no ticket and no human present to flip `state: draft` → `confirmed`; per the calling agent's explicit instruction to apply the recommended-default rule aggressively and not stop for review, the state is set to `confirmed` directly. Flagged here for a human to actually read on the next touchpoint.

### Implementation order
1. `splitTextIntoLines` / `splitTextIntoBlocks` (`text-blocks.ts`) — TDD, red-green, covers SCENARIO 1 and SCENARIO 6
2. `TextAnnotationPanel` render change in `text-review.tsx` — wire the per-block rewrite button to the existing `onChatAboutThis` prop, covers SCENARIO 1, 2, 3
3. Manual sanity check via `check-ui` skill (renders correctly, no crash on empty text) — SCENARIO 6

### Scope boundary
- No change to the Writer/Plotter prompts or output contract.
- No new API endpoint, no new DB column/table/migration.
- No change to the plan-phase (outline) chat flow — text phase only, per the task's own framing.
- No "finalize/lock all blocks" concept — approve-story remains the single terminal action.
- No fix for the pre-existing duplicate-substring find/replace ambiguity.
