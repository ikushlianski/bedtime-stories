---
type: todo
branch: story-chat
task: Add a chat interface for commenting on any story — patches drafts, captures feedback on read stories
state: open
updated: 2026-07-18
---
# Todo: Story chat comments

## Decisions to make
Nothing to decide.

## To review / clarify
Nothing to review.

## Manual steps
No manual steps required. Every schema change (nullable column, new `context` column with a default, new table, new `stage` union literal) is additive — `drizzle-kit generate` needs no interactive rename confirmation.

## Post-deploy checks
No post-deploy checks needed.
