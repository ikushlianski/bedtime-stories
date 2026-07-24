---
type: spec
branch: main
task: Show the first sentence of the story's prompt/seed on the story card, truncated
complexity: simple
state: confirmed
updated: 2026-07-24
---

# Spec: Story card prompt preview

### What to do
Add an optional `seed` prop to `StoryCard` and render a short preview of it — the first
sentence, truncated to a sane length — underneath the title/meta area. Extract the truncation
logic into a pure, unit-testable helper `deriveTitlePreview(seed: string, maxLength: number): string`
in a co-located module next to `story-card.tsx` (not inlined in JSX). Rule: split on the first
sentence-ending punctuation (`.`, `!`, `?`) followed by a space or end of string; if that first
sentence is within `maxLength` characters, show it as-is (including its terminal punctuation);
otherwise hard-truncate at `maxLength` characters at a word boundary and append `…`. Default
`maxLength` is 100 characters — long enough to convey the story's subject in a 2-3 column grid
card without pushing the layout past a couple of lines, short enough to keep every card a
predictable height. No seed → render nothing (no empty paragraph, no placeholder dash).

The `seed` field already exists end-to-end (DB column, `Story` type, API list/get responses via
`toSnakeCase`) — this is a pure frontend change. Wire `story.seed` through from both places that
render `StoryCard` with a `Story` object: `SortableStoryCard` in `story-list.tsx` and `Section`
in `inbox.tsx`.

### Files to touch
```
packages/web/src/components/
├── story-card.tsx                  — add optional `seed` prop, render preview paragraph using
│                                      text-base-content/65 (matches existing meta-row opacity)
├── derive-title-preview.ts         — new: pure helper, exported for the test file
├── derive-title-preview.test.ts    — new: unit tests (sentence-boundary case, hard-truncation
│                                      case, empty/whitespace input)
└── story-card.test.tsx             — new: component tests — short seed renders in full, long
                                       seed renders truncated with ellipsis, missing seed renders
                                       no preview element
packages/web/src/pages/
├── story-list.tsx                  — pass seed={story.seed ?? undefined} into StoryCard inside
│                                      SortableStoryCard
└── inbox.tsx                       — pass seed={item.story.seed ?? undefined} into StoryCard
                                       inside Section
```

### Done when
- A story card in the dashboard/inbox/story-list grid shows the first sentence of its seed text,
  truncated with `…` when the seed is long, directly under the existing title/meta row.
- A story with no seed shows the card exactly as it does today — no visual regression, no empty
  placeholder.
- `npx tsc --noEmit` is clean and `npx vitest run` passes, including new tests for the helper and
  the component.

### Decisions made autonomously
- **Preview length: 100 characters.** Reversible, low-stakes, no established convention in the
  file to follow (the only other prompt-preview pattern, `idea-card.tsx`, renders the full seed
  text unconstrained — sized for a different, roomier card layout). 100 chars fits a 2-3 column
  grid card without materially changing card height in the common case.
- **Truncation module location: co-located with `story-card.tsx` as its own file**, not inlined,
  per this repo's CLAUDE.md rule to extract testable logic into small plain functions with their
  own tests.
- **No seed renders nothing** (not a dash or placeholder), consistent with how `seriesId` and
  `rating` already conditionally render nothing when absent in this same component.
