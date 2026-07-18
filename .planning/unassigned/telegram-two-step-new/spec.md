---
state: confirmed
---

# Telegram two-step /new flow

GitHub issue #295 (ikushlianski/bedtime-stories).

## Problem

Today `/new` in Telegram just prompts "type your idea", then the next free-text
message either matches an existing story ID (`parseStoryIdMessage`) or becomes a
new story's seed under whatever `resolveDefaultUniverseId()` guesses (most
recently used universe, or the first one). There is no explicit universe choice,
unlike the web create-story modal (`packages/web/src/components/create-story-modal.tsx`)
which has a required universe `<select>`.

## Behavior change

1. `/new` replies with an inline keyboard listing every universe (`story_groups`).
2. Tapping a universe stores that choice against the chat and prompts for the
   outline text.
3. The next plain-text message from that chat is treated as the seed for the
   chosen universe — it bypasses `parseStoryIdMessage` and
   `resolveDefaultUniverseId()` entirely — and fires the pipeline via the same
   insert-story-then-`dispatchAutoPipeline` path as `createStoryAndFire`, but
   with the explicit `groupId`.
4. Any Telegram interaction that does not start with `/new` keeps exactly
   today's behavior (ID lookup, then the existing fallback heuristic).

## State storage decision

**Chosen: a DB table (`telegram_pending_actions`), not an in-memory `Map`.**

Why: `infra/index.ts` provisions the Cloud Run service (`bedtime-api`,
`infra/index.ts:98-129`) with only `autoscaling.knative.dev/maxScale: '3'` set —
no `minScale` annotation, so the service uses Cloud Run's default `minScale: 0`
and can scale to zero and cold-start on the next request. An in-memory map
would silently lose the "user tapped a universe, waiting for the outline" state
if the container recycles between the callback tap and the next text message —
a real gap for a single-user bot where those two actions can be minutes apart.
A DB row survives cold starts and costs one small table.

Keyed by `chat_id` only, per `telegram-utils.ts`'s existing single-user model
(`deriveIsAuthorizedUser` — no multi-tenant concept).

Added a 30-minute expiry (checked at consume time, not a cron): if the user
picks a universe and then goes quiet, a stale row must not silently hijack an
unrelated later message as a story seed. This is a safety default, not
requested explicitly, but cheap and consistent with "no code comments unless
explaining a non-obvious constraint" — the constraint here is exactly that
kind of non-obvious risk.

## Data model

New table `telegram_pending_actions` (packages/core/src/db/schema.ts):

```
chat_id     bigint (mode: number)  primary key
universe_id integer references story_groups(id), not null
created_at  timestamp default now()
```

One row per chat, upserted on conflict. Consumed (read + deleted) by the next
`message:text` handler.

## Implementation shape

- `packages/api/src/routes/telegram-pending-action.ts` — new module:
  - `buildPendingActionUpsert(chatId, universeId, now)` — pure, builds the insert/update values (unit tested).
  - `isPendingActionExpired(createdAt, now, ttlMs)` — pure TTL check (unit tested).
  - `setPendingUniverseChoice(chatId, universeId)` — db upsert glue (not unit tested; exercised at runtime).
  - `consumePendingUniverseChoice(chatId)` — db select + delete + TTL glue (not unit tested; exercised at runtime).
- `packages/api/src/routes/telegram.ts`:
  - `/new` handler replies with an inline keyboard of all universes
    (`newpick:<universeId>` callback data) instead of the current static prompt.
  - New callback handler matching `/^newpick:\d+$/` calls `setPendingUniverseChoice`
    then prompts for the outline.
  - `createStoryAndFire` refactored to share an `insertAndDispatchStory(seedText, universeId)`
    helper with a new `createStoryForUniverse(seedText, universeId)` path used
    when a pending choice exists.
  - `message:text` handler checks `consumePendingUniverseChoice(chatId)` **before**
    `parseStoryIdMessage` — if a live (non-expired) pending choice exists, it wins
    unconditionally, skipping both the ID-lookup and the default-universe fallback.
- Migration: run `npx drizzle-kit generate` against the new table, then apply
  with `npm run db:migrate` (never hand-write SQL, never `drizzle-kit migrate` directly).

## Definition of Done — per layer

**Backend**

1. `POST /api/telegram/webhook` with a `/new` command update from the allowed
   user replies with `sendMessage` containing an `inline_keyboard` where each
   row is one universe's name, callback_data `newpick:<id>`.
2. `POST /api/telegram/webhook` with a `callback_query` update, `data: "newpick:<id>"`,
   from the allowed user: replies `answerCallbackQuery` + a `sendMessage` prompting
   for the outline, and a row exists in `telegram_pending_actions` for that chat_id
   with that universe_id (verified via a Neon `run_sql` SELECT or equivalent).
3. `POST /api/telegram/webhook` with a plain-text `message` update from the same
   chat: a new row in `stories` is inserted with `group_id` equal to the
   explicitly chosen universe (not whatever `resolveDefaultUniverseId()` would
   have picked if it differs), and the `telegram_pending_actions` row is deleted.
4. A plain-text message from a chat with **no** pending action still runs the
   existing ID-lookup-or-fallback path, unchanged.

**Frontend**: N/A — not touched.

**Infrastructure**: migration file under `packages/core/src/db/migrations/`
generated by drizzle-kit for the new table; no Pulumi/Cloud Run changes needed.

## Verification results (actual)

- `npx vitest run`: 64 test files, 436 tests, all passing (includes 4 new pure-logic
  tests in `telegram-pending-action.test.ts` and 5 new integration tests in
  `telegram-new-flow.test.ts` using grammy's `bot.api.config.use` transformer to
  capture outgoing calls without hitting the network).
- `npx tsc --noEmit`: clean.
- Migration applied to a disposable Neon branch (`telegram-two-step-new-verify`,
  forked off `main`, TTL to 2026-07-25) — never touched `main` or the archived
  `dev` branch.
- Docker `development`-target build + `docker run` against that branch, three
  real webhook POSTs to `/api/telegram/webhook`:
  1. `/new` → reads `story_groups`, attempts `sendMessage` with the universe
     keyboard (fails downstream with Telegram's real "chat not found" for the
     synthetic chat id — expected, since no real chat exists to receive it;
     the DB read and payload construction already happened by that point,
     and were additionally proven byte-for-byte via the vitest transformer test).
  2. `callback_query` with `newpick:5` (picking "Эмма", universe id 5 —
     deliberately NOT the fallback universe id 1, which is what the most
     recent story in the branch already used) → confirmed via `run_sql`:
     a `telegram_pending_actions` row appeared with `universe_id = 5`.
  3. Plain-text message from the same chat → confirmed via `run_sql`: a new
     `stories` row (id 121) was inserted with `group_id = 5` (the explicit
     choice, not the fallback), and the pending-action row was gone
     (consumed). The real pipeline was dispatched in-process (no
     `PIPELINE_QUEUE` configured on this branch), incurring one real,
     small OpenRouter cost — same as manually exercising the feature once.
  4. A numeric plain-text message (`"118"`) with no pending action first ran
     the existing ID-lookup path (`showStory`, confirmed via stack trace and
     via `max(id)` on `stories` staying at 121 — no new story was created).

Reordered the `newpick:*` callback handler to call `setPendingUniverseChoice`
before `answerCallbackQuery` (existing callback handlers ack first) so the
durable state write does not depend on the Telegram acknowledgment succeeding.
