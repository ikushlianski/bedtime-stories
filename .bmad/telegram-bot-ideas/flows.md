---
type: flows
branch: main
task: telegram-bot-ideas
state: confirmed
updated: 2026-04-30
---

# Key Flows: Telegram Bot for Story Ideas

## Happy path — idea submission

```
Telegram user
    │  plain text message
    ▼
Grammy bot (message:text handler)
    │  deriveIsAuthorizedUser → authorized?
    │  yes → store pendingText[userId] = messageText
    │  load storyGroups from DB
    ▼
Bot replies: inline keyboard (one button per universe)
    │
    │  user taps universe button
    ▼
Grammy bot (callbackQuery "universe:<id>")
    │  retrieve pendingText[userId]
    │  deriveIdeaFromMessage(text, universeId)
    │  INSERT storyIdeas (approved)
    │  INSERT stories (draft, mode=auto)
    │  load universe context from DB
    │  triggerAutoPipeline(storyId, seed, ...) ← fire-and-forget
    │  answer callbackQuery (removes spinner)
    ▼
Bot replies: "Story #N created, pipeline started ✓"
    │
    ▼
Auto pipeline runs in background (existing flow)
    plan phase → text phase → story status = ready
```

## Unauthorized sender

```
Telegram user (not owner)
    │  any message
    ▼
Grammy bot (message:text handler)
    │  deriveIsAuthorizedUser → not authorized
    │  return — no reply, no DB writes
```

## Bot disabled (no token)

```
API startup
    │  TELEGRAM_BOT_TOKEN absent
    │  console.log "Telegram bot disabled (no TELEGRAM_BOT_TOKEN)"
    │  skip bot initialization
    ▼
Express starts normally — all non-Telegram routes unaffected
```

## Production webhook vs development polling

```
Production (NODE_ENV=production):
    Express server starts
        └── bot.api.setWebhook(PROD_URL/api/telegram/webhook)
    Telegram sends updates via HTTP POST
        └── /api/telegram/webhook → webhookCallback(bot, "express")

Development (NODE_ENV≠production):
    Express server starts
        └── bot.start() — long-polling loop in background
    Telegram pushes updates to polling connection
```
