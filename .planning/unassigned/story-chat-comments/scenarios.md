---
type: scenarios
branch: story-chat
task: Add a chat interface for commenting on any story — patches drafts, captures feedback on read stories
state: confirmed
updated: 2026-07-18
---
# Scenarios: Story chat comments

## Business Scenarios

SCENARIO 1: Targeted comment patches a draft plan passage

The parent selects a passage in the plan-review chat, describes a change, and the chat returns just that passage rewritten — the rest of the plan is untouched until the parent applies it.

What to verify:
- Selecting text and sending a message returns a patch + one-line summary when the model has a concrete replacement.
- Clicking apply replaces only the selected passage in `plan_v1`; no annotation row is created for this path.
- If the plan changed since the patch was proposed (the selected text no longer appears verbatim), applying returns an error instead of silently corrupting the plan.

SCENARIO 2: Targeted comment patches a draft text passage

Same as Scenario 1, but on the generated story text during the proofreading phase — this does not exist today and is new work.

What to verify:
- Selecting a passage in the text-review chat and sending a message returns a patch against the current active text version.
- Applying the patch creates a new story text version (never mutates a version in place) and makes it the story's active version.
- Same drift protection as Scenario 1: if the passage no longer matches verbatim, applying fails loudly rather than corrupting the version.

SCENARIO 3: Whole-story comment on a draft plan is banked, not applied

The parent sends a comment about the plan overall (no passage selected). The chat acknowledges it, but the plan text is not touched.

What to verify:
- Submitting with no selection stores the comment as a banked item and the chat confirms it was saved for the next regeneration — it does not alter `plan_v1`.
- The banked comment is visible somewhere in the UI as "not yet applied."

SCENARIO 4: Whole-story comment on a draft text is banked, not applied

Same as Scenario 3, during the proofreading phase.

What to verify:
- Submitting with no selection banks the comment without creating a new text version.
- The banked comment is visible as pending in the text-review UI.

SCENARIO 5: Regenerate folds every banked plan comment into one pass

The parent has left several whole-story plan comments across multiple chat turns, then asks to regenerate. All of them are addressed in a single rewrite, not one rewrite per comment.

What to verify:
- All unresolved banked comments (both those created via the pre-existing highlight+note flow and the new no-selection chat flow) are included in the single regeneration call.
- Each banked comment is marked resolved afterward; comments with no text content are skipped without breaking the batch.
- This scenario extends existing behavior — the plan regeneration flow was already built for highlight-based annotations; it must not break for the new selection-less shape.

SCENARIO 6: Regenerate folds every banked text comment into one pass

Same as Scenario 5, for the text/proofreading regeneration flow.

What to verify:
- Unresolved banked text comments (selection-based and whole-story) are concatenated into one editor-feedback pass for the rewrite.
- Consumed comments are cleared afterward, matching today's behavior for text-context annotations.

SCENARIO 7: A comment on a finished story is recorded, never changes the story

The parent reads an already-approved or already-read story and leaves a comment (with or without a text selection). The story text is immutable at this point.

What to verify:
- The comment is durably persisted with a timestamp, a reference to the story, and a reference to the story's universe — attributable data a later universe-memory pass can read.
- No field on the story (text, plan, status) changes as a result.
- The comment appears immediately in a running list on the same page — no waiting for any regeneration.
- No LLM call is made for this path — a comment on a finished story is a plain record, not a conversation.

SCENARIO 8: Mutating chat/patch/bank actions are rejected once a story is finished

A comment or patch is attempted against a story that has already reached `ready`, `read`, or `archived` — a finished story, where the wishlist requires the chat can never change the text.

What to verify:
- The API rejects a plan- or text-context chat/patch/bank call against a finished story with a clear error, rather than silently banking a comment nobody will ever fold back in, or patching text that's no longer the source of truth.
- The rejection tells the caller to use the comments endpoint instead.
- Stories that haven't reached a finished state yet (whatever their exact status — plan drafting, text proofreading, or the narrow in-between window right after plan approval) are **not** newly restricted by this change — the existing, currently-ungated plan chat/patch flow keeps working exactly as it does today.

SCENARIO 9: Applying a patch after the underlying text drifted

Two patches are proposed in quick succession, or the story was regenerated between proposal and apply.

What to verify:
- The apply call fails with a clear "target not found — content may have changed" error for both plan and text patches, rather than a silent no-op or a corrupted replace.
- The chat conversation itself is unaffected — the parent can re-select the passage and try again.

## Technical/Architectural Scenarios

None beyond what's captured above — no new async boundary, external service, or infrastructure is introduced. All engine behavior (patch, bank, regenerate-fold, record) is a direct extension of the existing plan-chat and annotation pipelines.
