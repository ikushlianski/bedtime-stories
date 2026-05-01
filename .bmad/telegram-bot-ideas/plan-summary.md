---
type: plan-summary
branch: main
task: telegram-bot-ideas
state: confirmed
phases-skipped: []
updated: 2026-04-30
---

# Plan Summary: Telegram Bot for Story Ideas

## What changes in business logic

A new intake path for story ideas is added alongside the existing web UI. When the owner sends a plain-text message to the Telegram bot, the system:

1. Asks the owner to pick a target universe via inline buttons
2. Creates a `storyIdea` record with the message as the seed, marks it approved immediately
3. Creates a `stories` draft record tied to the idea
4. Fires the auto pipeline for that story

No human approval step is needed — bot submission implies approval. The `topic` field is set to a fixed sentinel ("Telegram") and `rationale` to "Submitted via Telegram bot", since the AI fields are not meaningful for a direct human submission.

Only the configured owner (matched by numeric Telegram user ID) can trigger any of this. All other senders are silently ignored.

## What changes in user experience

Owner opens Telegram, types a story seed (plain text), sends it. The bot replies with an inline keyboard listing all universes by name. Owner taps one. Bot replies: "Story #N created, pipeline started ✓". Owner checks the web UI for pipeline progress and the finished story. No second notification when the pipeline completes.

## What changes architecturally

A Grammy-based Telegram bot is introduced inside `packages/api`. It shares the same Express process — no new service, no new Docker container, no new deployment step.

- **Development**: bot runs in long-polling mode (`bot.start()`) alongside the Express server
- **Production (Cloud Run)**: bot registers a webhook at startup (`bot.api.setWebhook(...)`) and receives updates via a new unauthenticated Express route `/api/telegram/webhook`

The bot handler calls the same internal functions already used by the HTTP pipeline route: `db.insert` into `storyIdeas` and `stories`, then `triggerAutoPipeline`. No new abstractions are introduced; the bot is a thin orchestration layer over existing DB writes and the pipeline trigger.

In-memory `Map<userId, pendingText>` holds the seed text between the initial message and the universe callback. Safe for a single-owner personal tool; no persistence needed.

Two new env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_ID`.

## Decisions made autonomously

- `topic` field set to `"Telegram"` — human-submitted ideas have no AI-generated topic
- `rationale` field set to `"Submitted via Telegram bot"` — satisfies the non-null DB constraint
- In-memory map for pending seed text — no session plugin needed for a single-user bot
- Webhook route is mounted before `requireAuth` middleware so Telegram can POST without a cookie
- `TELEGRAM_WEBHOOK_URL` is not a separate env var — production URL `https://bedtime-agent.ilya.online/api/telegram/webhook` is derived from the known domain (hardcoded in the bot module, easy to override via env var if needed)
- Bot is not started at all (neither polling nor webhook setup) if `TELEGRAM_BOT_TOKEN` is absent — the app starts normally for environments without Telegram configured
