---
type: todo
branch: main
task: telegram-bot-ideas
state: open
updated: 2026-04-30
---

# Human Todo: Telegram Bot for Story Ideas

## Before implementation

- [ ] Create a Telegram bot via @BotFather, get the bot token — needed for TELEGRAM_BOT_TOKEN env var
- [ ] Find your numeric Telegram user ID (send /start to @userinfobot) — needed for TELEGRAM_ALLOWED_USER_ID
- [ ] Add to local .env: TELEGRAM_BOT_TOKEN=... and TELEGRAM_ALLOWED_USER_ID=...

## After implementation

- [ ] Add GitHub secrets: PROD_TELEGRAM_BOT_TOKEN and PROD_TELEGRAM_ALLOWED_USER_ID
- [ ] Verify webhook registration on first production deploy (check Cloud Run logs for "Telegram webhook set")
