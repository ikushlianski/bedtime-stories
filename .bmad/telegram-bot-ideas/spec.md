---
type: spec
branch: main
task: telegram-bot-ideas
state: confirmed
phases-skipped: []
updated: 2026-04-30
---

# Spec: Telegram Bot for Story Ideas

### Derivers

| Deriver | Inputs | Output | Scenarios covered |
|---------|--------|--------|-------------------|
| `deriveIsAuthorizedUser` | `fromId: number \| undefined`, `allowedId: number` | `boolean` | SCENARIO 2 |
| `deriveIdeaFromMessage` | `messageText: string`, `universeId: number` | `{ seedText: string, topic: string, rationale: string, universeId: number }` | SCENARIO 1 |

**`deriveIsAuthorizedUser`**: returns `true` iff `fromId` is defined and equals `allowedId`. Encodes the authorization rule.

**`deriveIdeaFromMessage`**: maps a raw Telegram message to a fully-shaped idea insert payload. `topic = "Telegram"`, `rationale = "Submitted via Telegram bot"`, `seedText = messageText.trim()`. Pure — no DB, no async.

### Files to create

```
packages/
└── api/
    └── src/
        └── routes/
            ├── telegram.ts                      — Grammy bot definition, message/callbackQuery handlers, pendingSeeds Map
            └── telegram.test.ts                 — unit tests for deriveIsAuthorizedUser and deriveIdeaFromMessage
```

### Files to modify

```
packages/
└── api/
    └── src/
        └── server.ts                            — mount /api/telegram/webhook before requireAuth; call bot.start() or setWebhook in startServer()
.env.example                                     — add TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USER_ID placeholders
.env                                             — add TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USER_ID placeholders (values filled by human)
.github/
└── workflows/
    └── deploy.yml                               — pass PROD_TELEGRAM_BOT_TOKEN and PROD_TELEGRAM_ALLOWED_USER_ID to Cloud Run
docker-compose.yml                               — expose TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USER_ID to api service
```

### Data model changes

No schema changes. The bot reuses existing `storyIdeas` and `stories` tables with existing columns:
- `storyIdeas.topic` ← `"Telegram"`
- `storyIdeas.rationale` ← `"Submitted via Telegram bot"`
- `storyIdeas.seedText` ← raw message text
- `storyIdeas.status` ← `"approved"` (set directly on insert, skip pending state)
- `storyIdeas.approvedAt` ← `new Date()`
- `stories.seed` ← `seedText`
- `stories.status` ← `"draft"`
- `stories.mode` ← `"auto"`
- `stories.source` ← `"agent"`

### Implementation order

1. `/tdd deriveIsAuthorizedUser` — covers SCENARIO 2
2. `/tdd deriveIdeaFromMessage` — covers SCENARIO 1
3. Implement `telegram.ts` — bot setup, message handler (store pending text, show universe keyboard), callbackQuery handler (retrieve pending text, insert idea + story, load universe context, call triggerAutoPipeline, reply with story ID)
4. Modify `server.ts` — mount webhook route before requireAuth; add bot startup logic (polling in dev, setWebhook in prod) guarded by token presence
5. Update env files and deploy pipeline — `.env`, `.env.example`, `docker-compose.yml`, `deploy.yml`

### Key implementation details for telegram.ts

```
Dependencies to install: grammy

Bot setup:
  const token = process.env['TELEGRAM_BOT_TOKEN']
  const allowedUserId = Number(process.env['TELEGRAM_ALLOWED_USER_ID'])
  // Export bot only if token exists; otherwise export null
  export const bot = token ? new Bot(token) : null

Pending seeds:
  const pendingSeeds = new Map<number, string>()  // userId → seedText

Message handler (bot.on('message:text')):
  1. if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return
  2. pendingSeeds.set(ctx.from.id, ctx.message.text.trim())
  3. Load storyGroups from DB
  4. Build InlineKeyboard with one button per universe: .text(name, `universe:${id}`)
  5. ctx.reply("Выбери вселенную:", { reply_markup: keyboard })

Callback query handler (bot.callbackQuery(/^universe:\d+$/)):
  1. if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return ctx.answerCallbackQuery()
  2. const universeId = parseInt(ctx.callbackQuery.data.split(':')[1])
  3. const seedText = pendingSeeds.get(ctx.from.id)
  4. if (!seedText) return ctx.answerCallbackQuery({ text: 'Нет ожидающего текста' })
  5. pendingSeeds.delete(ctx.from.id)
  6. const ideaPayload = deriveIdeaFromMessage(seedText, universeId)
  7. INSERT storyIdeas with ideaPayload + status='approved' + approvedAt=new Date()
  8. INSERT stories (groupId=universeId, seed=seedText, status='draft', mode='auto', source='agent')
  9. Load universe row from storyGroups (systemPrompt, universeContext, styleGuide)
  10. triggerAutoPipeline(storyId, seedText, systemPrompt, universeContext, styleGuide, universeId)
  11. ctx.answerCallbackQuery()
  12. ctx.reply(`Story #${storyId} создана, пайплайн запущен ✓`)

Error handling: wrap steps 7–12 in try/catch; on error: ctx.answerCallbackQuery(); ctx.reply('Ошибка при создании истории')
```

```
server.ts additions:
  - Import: import { bot } from './routes/telegram'
  - Before requireAuth: if (bot) app.post('/api/telegram/webhook', webhookCallback(bot, 'express'))
  - In startServer(), after app.listen callback:
      if (bot) {
        if (process.env['NODE_ENV'] === 'production') {
          const webhookUrl = 'https://bedtime-agent.ilya.online/api/telegram/webhook'
          bot.api.setWebhook(webhookUrl)
            .then(() => console.log('Telegram webhook set:', webhookUrl))
            .catch((e) => console.error('Telegram webhook setup failed:', e))
        } else {
          bot.start()
        }
      } else {
        console.log('Telegram bot disabled (no TELEGRAM_BOT_TOKEN)')
      }
```

### Scope boundary

- No pipeline completion notification via Telegram
- No /cancel or /help commands
- No multi-owner support
- No persistence for pending seeds (lost on restart — acceptable for personal tool)
- No changes to existing story-ideas or pipeline routes
