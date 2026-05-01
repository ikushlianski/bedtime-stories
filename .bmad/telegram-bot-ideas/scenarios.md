---
type: scenarios
branch: main
task: telegram-bot-ideas
state: confirmed
updated: 2026-04-30
---

# Scenarios: Telegram Bot for Story Ideas

## Business Scenarios

SCENARIO 1: Owner sends a story idea and picks a universe
  Type: business
  Actor: bot owner (Telegram user whose ID matches TELEGRAM_ALLOWED_USER_ID)

  The owner types a plain-text message such as "Гоша находит волшебный компас" and sends it to the bot. The bot immediately replies with a message containing an inline keyboard listing all universe names as buttons. The owner taps one universe. The bot creates a storyIdea record (status approved), a stories draft record, triggers the auto pipeline, and replies "Story #N created, pipeline started ✓". The owner opens the web UI and sees the new story in draft state with the pipeline running.

  Acceptance:
    Code:
      [ ] packages/api/src/routes/telegram.ts exists
      [ ] Bot message handler registered for text messages
      [ ] Callback query handler registered for universe selection
      [ ] triggerAutoPipeline imported and called from telegram.ts
    Behavior:
      [ ] storyIdeas row created with seedText = message text, topic = "Telegram", rationale = "Submitted via Telegram bot", status = "approved"
      [ ] stories row created with seed = seedText, status = "draft", mode = "auto", source = "agent"
      [ ] triggerAutoPipeline called with storyId, seedText, and universe systemPrompt/context/styleGuide
      [ ] Bot sends inline keyboard listing all storyGroups by name
      [ ] Bot replies with story ID after pipeline is started
    Integration:
      [ ] Callback query data encodes universeId (format: "universe:<id>")
      [ ] Universe context (systemPrompt, universeContext, styleGuide) loaded from DB before triggerAutoPipeline
    Observability:
      [ ] console.log or equivalent logs storyId and universeId on successful creation
    Tests:
      [ ] deriveIdeaFromMessage.test.ts asserts output shape given messageText and universeId

SCENARIO 2: Unauthorized user sends a message
  Type: business
  Actor: any Telegram user other than the owner

  A user who is not the configured owner sends a message. The bot does not reply and takes no action. No DB records are created.

  Acceptance:
    Code:
      [ ] deriveIsAuthorizedUser function exists in telegram.ts (or co-located file)
    Behavior:
      [ ] Message from non-owner user produces no DB writes
      [ ] Bot sends no reply to unauthorized users
      [ ] deriveIsAuthorizedUser returns false when fromId !== allowedId
    Integration:
      [ ] Authorization check runs before any DB query in the message handler
    Observability:
      [ ] Not applicable — silent ignore is intentional, no log noise needed
    Tests:
      [ ] deriveIsAuthorizedUser.test.ts asserts false for mismatched IDs, true for match

SCENARIO 3: Bot token is not configured
  Type: business
  Actor: system operator (deploying without Telegram)

  The API starts without `TELEGRAM_BOT_TOKEN` set. The server starts normally, serves all existing routes, and logs a message indicating the Telegram bot is disabled. No error is thrown.

  Acceptance:
    Code:
      [ ] Bot initialization is guarded: no token → no bot.start() and no webhook setup
    Behavior:
      [ ] Server starts and /_healthz returns 200 when TELEGRAM_BOT_TOKEN is absent
      [ ] A single console.log line is emitted: "Telegram bot disabled (no TELEGRAM_BOT_TOKEN)"
    Integration:
      [ ] /api/telegram/webhook route is not mounted when token is absent
    Observability:
      [ ] Not applicable — startup log is sufficient
    Tests:
      [ ] Not applicable — startup behavior tested manually; no unit test surface

SCENARIO 4: User sends a message, then sends another before picking a universe
  Type: business
  Actor: bot owner

  The owner sends "Идея А", bot shows universe picker. Before picking, the owner sends "Идея Б". The second message replaces the pending seed. When the owner picks a universe, "Идея Б" is used (not "Идея А"). The owner is not left in a broken state.

  Acceptance:
    Code:
      [ ] Pending seed stored in Map<userId, string> — overwritten on new message
    Behavior:
      [ ] Only the most recent pending text is used when universe is selected
      [ ] A new universe picker keyboard is shown for the second message
    Integration:
      [ ] Callback query for first universe pick after second message uses second seed
    Observability:
      [ ] Not applicable
    Tests:
      [ ] Not applicable — stateful Map behavior; covered by scenario 1 unit test logic

## Technical/Architectural Scenarios

SCENARIO 5: Webhook registration on production startup
  Type: technical
  Actor: system (Cloud Run startup)

  On first startup in production (NODE_ENV=production), the bot calls `bot.api.setWebhook` with the production URL. Subsequent requests from Telegram arrive at POST /api/telegram/webhook and are processed by the Grammy webhook callback. In development, bot.start() runs long-polling instead.

  Acceptance:
    Code:
      [ ] server.ts calls bot.api.setWebhook in production after Express server starts
      [ ] server.ts calls bot.start() in development
      [ ] Express route POST /api/telegram/webhook registered before requireAuth middleware
    Behavior:
      [ ] Webhook route returns 200 to Telegram updates
      [ ] Route is not protected by requireAuth
    Integration:
      [ ] webhookCallback(bot, "express") used for the Express handler
    Observability:
      [ ] Not applicable
    Tests:
      [ ] Not applicable — integration behavior
