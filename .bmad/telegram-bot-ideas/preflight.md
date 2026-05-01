---
type: preflight
branch: main
task: telegram-bot-ideas
state: confirmed
updated: 2026-04-30
---

# Preflight: Telegram Bot for Story Ideas

## Business Logic

- Story ideas created by the bot bypass the human review step — bot submission implies approval
- `topic` and `rationale` fields are non-null in the DB schema; bot fills them with sentinels
- The auto pipeline is fire-and-forget; errors surface in pipeline state (existing mechanism), not in the Telegram reply

## External API Contracts

Grammy webhook integration (confirmed from context7 / grammy.dev):
- `webhookCallback(bot, "express")` returns an Express-compatible request handler
- `bot.api.setWebhook(url)` registers the webhook; must be called after the server is listening
- `bot.start()` starts long-polling; runs as a background async loop; does not block
- Inline keyboard buttons: `InlineKeyboard` class, `.text(label, callbackData)` method
- Callback query data: string, max 64 bytes — universeId as "universe:<id>" fits comfortably
- `ctx.answerCallbackQuery()` must be called to dismiss the spinner on the button

## Assumptions & Risks

- **Assumption**: Cloud Run allows the bot to call `bot.api.setWebhook` on startup without a race condition.
  Risk if wrong: webhook URL is set before the server is ready; first few updates may fail. Mitigation: Grammy retries, and Cloud Run only routes traffic after the health check passes.

- **Assumption**: `TELEGRAM_ALLOWED_USER_ID` is a single numeric ID (personal tool, one owner).
  Risk if wrong: multiple owners need a comma-separated list — trivial to extend but not planned now.

- **Assumption**: The pending seed text stored in a module-level Map survives across requests within the same Cloud Run instance. Cloud Run keeps one instance warm during active use.
  Risk if wrong: if the instance is replaced between message and callback, the seed is lost. The user sees the universe picker but the callback finds no pending text → bot replies with an error message and the user retries.

- **Assumption**: `storyGroups` (universes) count is small enough (< 10) to fit in a single inline keyboard message.
  Risk if wrong: Telegram inline keyboard has a 64-key limit per message — not a practical concern for this app.

## Gaps

- No mechanism to cancel a pending universe selection (e.g., if the user changes their mind before picking). Out of scope; user can just send a new message to replace the pending seed.

## Conflicts

None. The bot reuses existing DB write patterns and `triggerAutoPipeline` without modifying them.
