---
type: spec
branch: story-chat
task: Add a chat interface for commenting on any story — patches drafts, captures feedback on read stories
complexity: complex
state: confirmed
updated: 2026-07-18
---
# Spec: Story chat comments

### Implementation Phases

Single phase — the three behaviors (targeted patch, banked comment, read-story record) share the same entry points and must land together for the chat surface to be coherent; there is no safe intermediate cut that ships one behavior without the schema and gating the others depend on.

### Derivers

| Deriver | Inputs | Output | Scenarios covered |
|---------|--------|--------|--------------------|
| `formatCommentsAsFeedback` | Array of `{ selectedText: string \| null, noteText: string \| null }` | Formatted feedback block string — targeted items rendered as "К фрагменту «X»: note", whole-story items rendered as "Общий комментарий: note", items with no `noteText` skipped | SCENARIO 5, SCENARIO 6 |
| `computePatchedText` | `{ currentText: string, find: string, replace: string }` | `{ ok: true, text: string } \| { ok: false, reason: 'not_found' }` | SCENARIO 1, SCENARIO 2, SCENARIO 9 |
| `parsePatchBlock` | Raw LLM response string | `{ patch: string, summary: string } \| null` | SCENARIO 1, SCENARIO 2 |
| `resolveChatGate` | `{ storyStatus: Story['status'], intent: 'mutate' \| 'record' }` | `{ allowed: true } \| { allowed: false, reason: string, suggestedEndpoint: string }` — `mutate` (chat patch or banking) is allowed unless `storyStatus` is `ready`/`read`/`archived`; `record` (the comments endpoint) is allowed only when it is | SCENARIO 3, SCENARIO 4, SCENARIO 7, SCENARIO 8 |
| `buildStoryCommentRecord` | `{ storyId: number, groupId: number \| null, commentText: string, selectedText: string \| null }` | Insert payload for `story_comments` (with `universeId` set from `groupId`, `null` if the story has no group) | SCENARIO 7 |

### Files by scenario

| Scenario | Backend files | Frontend files | Infrastructure files |
|----------|---------------|-----------------|------------------------|
| SCENARIO 1 | `packages/api/src/routes/pipeline-questions.ts` — generalize conversation POST to accept `context`; `packages/api/src/routes/stories.ts` — `apply-plan-patch` gains a `resolveChatGate` check that only rejects calls against a finished (`ready`/`read`/`archived`) story — no behavior change for any story it already serves today | `packages/web/src/pages/story-chat-panel.tsx` (renamed from `plan-conversation-panel.tsx`), `packages/web/src/pages/plan-review.tsx` — updated import/wiring | None |
| SCENARIO 2 | `packages/api/src/routes/pipeline-questions.ts` — source text becomes active `story_text_versions.text` when `context='text'`; `packages/api/src/routes/stories.ts` — new `apply-text-patch` route | `packages/web/src/pages/story-chat-panel.tsx`, `packages/web/src/pages/text-review.tsx`, `packages/web/src/pages/story-reader.tsx` (proofreading branch) | None |
| SCENARIO 3 | `packages/api/src/routes/pipeline-questions.ts` — no-selection branch now inserts an `annotations` row | `packages/web/src/pages/story-chat-panel.tsx` — banked confirmation state; `packages/web/src/components/plan-annotator.tsx` — unchanged, already renders unresolved plan annotations | None |
| SCENARIO 4 | `packages/api/src/routes/pipeline-questions.ts` (shared with Scenario 3), `packages/api/src/routes/stories.ts` — `createAnnotationSchema` loosened (`selected_text` optional) | `packages/web/src/pages/story-chat-panel.tsx`, `packages/web/src/pages/text-review.tsx` — pending-comments list | None |
| SCENARIO 5 | `packages/api/src/routes/pipeline-plan-redo.ts` — null-safe `formatAnnotationsAsFeedback` → shared `formatCommentsAsFeedback`; `packages/core/src/pipeline/annotation-resolver.ts` — nullable `selectedText` | None (existing plan-review UI already surfaces resolved summaries) | None |
| SCENARIO 6 | `packages/api/src/routes/pipeline-text-critique.ts` — null-safe `formatAnnotationsAsFeedback` → shared `formatCommentsAsFeedback` | None (existing text-review UI already surfaces version history) | None |
| SCENARIO 7 | New `packages/api/src/routes/story-comments.ts` (`POST`/`GET /stories/:id/comments`) mounted in `packages/api/src/index.ts` or `stories.ts` router tree | `packages/web/src/pages/story-chat-panel.tsx` (read mode), `packages/web/src/pages/story-reader.tsx` (ready/read branch) | None |
| SCENARIO 8 | `packages/api/src/routes/pipeline-questions.ts`, `packages/api/src/routes/stories.ts` (`annotations` create route), `packages/core/src/pipeline/resolve-chat-gate.ts` (new deriver module) | `packages/web/src/pages/story-chat-panel.tsx` — surfaces the rejection reason | None |
| SCENARIO 9 | `packages/api/src/routes/stories.ts` (`apply-plan-patch`, new `apply-text-patch`) — both call `computePatchedText` | `packages/web/src/pages/story-chat-panel.tsx` — surfaces the 422 as an inline error, keeps chat state intact | None |

### Files to create

```
packages/core/src/pipeline/
  format-comments-as-feedback.ts   — formatCommentsAsFeedback deriver + unit tests, replaces the two duplicated copies
  compute-patched-text.ts          — computePatchedText deriver + unit tests, shared by apply-plan-patch and apply-text-patch
  resolve-chat-gate.ts             — resolveChatGate deriver + unit tests, status/intent → allowed/rejected
  build-story-comment-record.ts    — buildStoryCommentRecord deriver + unit tests

packages/api/src/routes/
  story-comments.ts                — POST/GET /stories/:id/comments

packages/web/src/pages/
  story-chat-panel.tsx             — generalized chat UI (supersedes plan-conversation-panel.tsx)
```

### Files to modify

```
packages/core/src/db/schema.ts
  — annotations.selectedText: notNull() removed (nullable)
  — planConversations: name unchanged, adds context column ('plan'|'text', default 'plan') — additive only, no rename
  — new storyComments table
  — storyTextVersions.stage type union gains 'chat_patch'

packages/core/src/pipeline/annotation-resolver.ts
  — AnnotationInput.selectedText: string | null; prompt formatting uses formatCommentsAsFeedback-equivalent phrasing for null case

packages/api/src/routes/pipeline-questions.ts
  — conversation GET/POST gain context param; POST resolves source text by context, banks a comment when no selection is present, applies resolveChatGate before proceeding

packages/api/src/routes/pipeline-plan-redo.ts
  — local formatAnnotationsAsFeedback replaced with shared formatCommentsAsFeedback (null-safe)

packages/api/src/routes/pipeline-text-critique.ts
  — local formatAnnotationsAsFeedback replaced with shared formatCommentsAsFeedback (null-safe)

packages/api/src/routes/stories.ts
  — createAnnotationSchema: selected_text optional, position_start/position_end optional; annotation create route applies resolveChatGate
  — apply-plan-patch: revalidated against resolveChatGate, uses computePatchedText deriver
  — new apply-text-patch route: same pattern against active story_text_versions row, inserts new version rather than mutating in place

packages/web/src/pages/plan-review.tsx
  — updated to import/use story-chat-panel.tsx

packages/web/src/pages/text-review.tsx
  — wires StoryChatPanel (context='text') alongside the existing selection-popover annotation flow

packages/web/src/pages/story-reader.tsx
  — proofreading branch wires StoryChatPanel (context='text'); ready/read/archived branch wires StoryChatPanel (context='read') with the persisted comments list

packages/web/src/lib/api.ts
  — client methods for the generalized conversations endpoints (context param), apply-text-patch, and the new comments endpoints
```

### Data model changes

See `architecture.md` → "Data model evolution" for full detail. Summary:
- `annotations.selected_text` becomes nullable (whole-story banked comments have no span).
- `plan_conversations` keeps its name, gains `context` (`'plan' | 'text'`, default `'plan'`) — purely additive, no rename.
- New table `story_comments`: `id`, `story_id`, `universe_id` (nullable), `comment_text`, `selected_text` (nullable), `created_at`. Never consumed/deleted — permanent history for a future universe-memory read.
- `story_text_versions.stage` union gains `'chat_patch'`.

All schema changes go through `drizzle-kit generate` + `npm run db:migrate` per project convention — never applied by hand.

### Documentation changes

- `docs/architecture/04-feedback-and-review.md` — currently describes annotations as tied to plan/text highlight+note only (line 5, line 12 Mermaid label). Update to describe the generalized chat entry point, the nullable-selection whole-story comment case, and the new read-story comment path (currently undocumented — the doc has no mention of any post-`ready` feedback mechanism beyond `parent_reviews`/`child_reactions`/`story_readings`).
- `docs/architecture/05-data-model.md` — update the `annotations` entity description (line 5, line 18, line 79 ER block) to reflect the nullable `selected_text`, and add the new `story_comments` table to the ER diagram and prose (parallel to how `parent_reviews`/`child_reactions` are described).

### Decisions made autonomously

- Plan auto-confirmed by grand-loop (no human present to review) — consistency gate passed with 0 gaps.
- **Targeted vs whole-story signal**: presence/absence of a text selection (not an LLM classification step, not a separate UI toggle) — reuses the interaction pattern already proven in `PlanAnnotator`'s "chat about this" flow, generalized to text and read contexts. Lower-risk than classification (no misclassification failure mode) and no extra UI control to teach.
- **Text patch mechanism differs from plan patch mechanism on purpose**: plan patches mutate `plan_v1` in place (matching existing behavior — plans have no version history table); text patches insert a new `story_text_versions` row and repoint `active_text_version_id` (matching existing behavior — text already has an immutable version history via `annotated_rewrite`/critique). Forcing text patches to also mutate in place would break the existing version-history invariant; forcing plan to gain a version table is out of scope creep the wishlist doesn't ask for.
- **Reuse `annotations` for banked draft comments, new table for read-story comments**: `annotations` rows are consumed (resolved or deleted) by the existing regenerate flows — a store a future universe-memory sync reads from must never lose rows to consumption, so read-story comments get their own durable table (`story_comments`) rather than being shoehorned into `annotations` with `resolvedAt` permanently null (which is exactly the accidental, undesigned state found in the codebase today).
- **No LLM call for read-story comments**: the wishlist only asks that the comment be captured, not that it be conversational — a plain record-and-list endpoint is cheaper, has no patch-drift failure mode, and matches the "captures feedback" wording more literally than a full chat round trip would.
- **`plan_conversations` keeps its name; only a `context` column is added, no table rename.** A rename was the first instinct (once the table stores both plan- and text-phase turns, the old name under-describes its contents) but was rejected: `drizzle-kit generate` prompts interactively to confirm a detected rename versus a drop+create, and this plan runs unattended overnight with no human present to answer that prompt — answering it wrong destroys every existing plan-conversation row. A plain additive column carries the same functional value with no interactive step and no data-loss failure mode. Revisit the rename later, with a human present to confirm the migration prompt.
- **Read-context comments never enter `plan_conversations`**: since there's no LLM round trip for that path (comments endpoint decision below), there's no conversational turn to log — the single write to `story_comments` is enough. Avoids a phantom conversation log that exists but is always exactly one message long.
- **Mutate-vs-record gate is "has the story reached a finished state," not a specific in-progress status.** The existing `apply-plan-patch` endpoint reads `planV1 ?? planFinal` with no status check at all today, and `planFinal` is populated at plan approval — before `status` necessarily reflects it, and unconditionally for legacy stories. Gating plan/text mutation to one exact status value (`draft` only, or `proofreading` only) would reject calls the current, already-shipped code happily serves — a real regression, not a hardening. Instead `resolveChatGate`'s `mutate` intent is allowed for any status **except** `ready`/`read`/`archived`; the `record` intent (the new comments endpoint) is allowed **only** for those three. This still delivers the one hard rule the wishlist actually states — a finished story's chat can never change its text — without inventing a new restriction on the in-progress lifecycle that nothing today enforces.
- **New `story_text_versions.stage` literal (`'chat_patch'`) rather than reusing `'annotated_rewrite'`**: a single-passage chat-driven patch and a full batched annotation rewrite are different operations worth distinguishing in version history, even though both are triggered by comment-shaped input.

### Implementation order

1. `/tdd formatCommentsAsFeedback` — covers SCENARIO 5, SCENARIO 6
2. `/tdd computePatchedText` — covers SCENARIO 1, SCENARIO 2, SCENARIO 9
3. `/tdd parsePatchBlock` — covers SCENARIO 1, SCENARIO 2
4. `/tdd resolveChatGate` — covers SCENARIO 3, SCENARIO 4, SCENARIO 7, SCENARIO 8
5. `/tdd buildStoryCommentRecord` — covers SCENARIO 7
6. Schema migration: nullable `annotations.selected_text`, additive `context` column on `plan_conversations` (name unchanged), new `story_comments` table, `story_text_versions.stage` union extension — every change here is additive, so `drizzle-kit generate` needs no interactive rename confirmation; run via `npm run db:migrate`
7. Update `annotation-resolver.ts` and both `formatAnnotationsAsFeedback` call sites (`pipeline-plan-redo.ts`, `pipeline-text-critique.ts`) to use the new shared deriver
8. Generalize `pipeline-questions.ts` conversation GET/POST (context param, banking on no-selection, gate check)
9. Add `apply-text-patch` route; revalidate `apply-plan-patch` and the `annotations` create route against `resolveChatGate`
10. New `story-comments.ts` route (POST/GET), mounted alongside the other story sub-routes
11. `packages/web/src/lib/api.ts` client methods for all of the above
12. Frontend: generalize `plan-conversation-panel.tsx` → `story-chat-panel.tsx`; wire into `plan-review.tsx` (context swap only), `text-review.tsx` (new), `story-reader.tsx` (both the proofreading and ready/read branches)
13. Update `docs/architecture/04-feedback-and-review.md` and `docs/architecture/05-data-model.md`

### Definition of Done — per layer

**Backend**

- `curl -X POST http://localhost:8020/api/pipeline/conversations/<storyId> -H 'Content-Type: application/json' -d '{"message":"make the dragon less scary","selectedText":"the dragon roared","context":"plan"}'` against a story with `status='draft'` returns 200 with a JSON body containing `patch` and `patchSummary` populated (a concrete replacement was proposed) — confirms targeted-comment patching still works after generalization (Scenario 1).
- The equivalent call with `"context":"text"` against a story with `status='proofreading'` returns 200 with `patch`/`patchSummary` describing a change to the active text version, not the plan (Scenario 2). Following it with `curl -X POST .../stories/<storyId>/apply-text-patch -d '{"find":"...","replace":"...","summary":"..."}'` returns 200 and `GET /api/stories/<storyId>` shows a new `active_text_version_id` pointing at a version whose text contains the replacement, while `text_v1`/earlier versions are untouched.
- `curl -X POST .../pipeline/conversations/<storyId> -d '{"message":"the pacing feels rushed overall","context":"plan"}'` (no `selectedText`) against a `draft` story returns 200 with no `patch` field, and a follow-up `curl .../stories/<storyId>/annotations?context=plan` shows a new row with `selected_text: null`, `note_text` containing the message, `resolved_at: null` (Scenario 3/4 — banked, not applied — `plan_v1` unchanged via `GET /api/stories/<storyId>`).
- Triggering `POST /api/stories/<storyId>/redo-plan` after banking two or more whole-story plan comments results in exactly one new Plotter run (one `run_snapshots` row inserted, verified via `GET`/DB query), and both banked annotations now have `resolved_at` set (Scenario 5).
- `curl -X POST .../stories/<storyId>/comments -d '{"comment_text":"Sasha loved this one"}'` against a story with `status='read'` returns 200/201, and a subsequent `curl .../stories/<storyId>/comments` (GET) lists it with a `created_at` and the story's `universe_id` populated. `curl .../stories/<storyId>` before and after shows no field changed (Scenario 7).
- `curl -X POST .../pipeline/conversations/<storyId> -d '{"message":"x","context":"plan"}'` against a story with `status='read'` returns 409 with an error body naming the comments endpoint as the correct one to use (Scenario 8).
- Re-running the Scenario 1/2 patch `curl` calls with a `find` string that no longer appears in the current plan/text (simulate by editing the story between propose and apply) returns 422 with an explicit "target not found" error, and `GET /api/stories/<storyId>` confirms the plan/text is unchanged (Scenario 9).
- New unit tests pass: `npx vitest run packages/core/src/pipeline/format-comments-as-feedback.test.ts packages/core/src/pipeline/compute-patched-text.test.ts packages/core/src/pipeline/resolve-chat-gate.test.ts packages/core/src/pipeline/build-story-comment-record.test.ts`.

**Frontend**

- Opening `/stories/<id>/plan-review` for a `draft` story: selecting a plan passage and using the chat panel behaves exactly as before the change (patch preview + "Применить" button) — no regression (Scenario 1).
- Opening `/stories/<id>/text-review` (or the story-reader proofreading view) for a `proofreading` story: selecting a text passage and sending a chat message shows a patch preview with an apply action; applying it updates the displayed text and the version history list gains a new entry (Scenario 2).
- On the same page, sending a chat message with no selection shows a "saved — will be included in the next regeneration" confirmation, and a visible pending-comments count/list increases by one; the displayed story text does not change (Scenario 3/4).
- Opening a `ready` or `read` story in `story-reader.tsx` shows an always-visible comment box (no passage selection required). Submitting a comment shows it appended to a running list on the same page within the same interaction — no page reload, no regeneration UI, no patch/apply controls rendered anywhere on this view (Scenario 7).
- Attempting to trigger a plan/text chat/patch flow against a `ready`/`read` story is not offered in the UI at all (the chat panel renders in read-only comment mode for those statuses) — there is no client-side path that could even attempt the rejected call from Scenario 8.

**Infrastructure**

N/A — not touched. No new cloud resources, IaC changes, or deploy pipeline changes; this is an application-layer feature entirely within the existing API/DB/web stack.

### Scope boundary

Out of scope for this task:
- Wiring `story_comments` (or resolved `annotations`) into `synthesize-universe-memory.ts`'s `syncUniverseMemory` — a later task connects the data sources; this task only ensures `story_comments` is shaped so that connection is easy (durable, timestamped, universe-attributable, never consumed).
- Any change to `synthesize-universe-memory.ts` itself.
- Structured/rated feedback (`parent_reviews`, `child_reactions`, `value_for_money_feedback`) — those remain single-row-per-story forms, untouched by this work.
- Real-time/streaming chat UX (typing indicators, streaming tokens) — the chat remains request/response, matching the existing plan-chat pattern.
- Any handling of the `archived` status beyond defensively treating it as record-only in `resolveChatGate` — no new UI or workflow for archiving is introduced.
- Multi-user/concurrent-edit conflict resolution beyond the existing find/replace drift check (Scenario 9) — no locking, no operational transform.
