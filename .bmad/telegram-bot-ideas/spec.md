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

**`deriveIsAuthorizedUser`**: returns `true` iff `fromId` is defined and equals `allowedId`.

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
Dependencies to install: grammy @grammyjs/conversations

Types:
  type BotContext = ConversationFlavor<Context>
  type BotConversation = Conversation<BotContext>

Bot setup:
  const token = process.env['TELEGRAM_BOT_TOKEN']
  const allowedUserId = Number(process.env['TELEGRAM_ALLOWED_USER_ID'])
  export const bot = token ? new Bot<BotContext>(token) : null
  if (bot) {
    bot.use(conversations())
    bot.use(createConversation(ideaConversation))
  }

Pending seeds:
  const pendingSeeds = new Map<number, { seedText: string; universeId: number }>()

Message handler (bot.on('message:text')):
  1. if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return
  2. pendingSeeds.set(ctx.from.id, { seedText: ctx.message.text.trim(), universeId: 0 })
     (universeId=0 is a placeholder — it will be filled by callback before entering conversation)
  3. Load storyGroups from DB
  4. Build InlineKeyboard: one button per universe → .text(name, `universe:${id}`)
  5. ctx.reply("Выбери вселенную:", { reply_markup: keyboard })

Callback query handler (bot.callbackQuery(/^universe:\d+$/)):
  1. if (!deriveIsAuthorizedUser(ctx.from?.id, allowedUserId)) return ctx.answerCallbackQuery()
  2. universeId = parseInt(ctx.callbackQuery.data.split(':')[1])
  3. pending = pendingSeeds.get(ctx.from.id)
  4. if (!pending) return ctx.answerCallbackQuery({ text: 'Нет ожидающего текста — отправь идею ещё раз' })
  5. pending.universeId = universeId
  6. ctx.answerCallbackQuery()
  7. ctx.conversation.enter('ideaConversation')

Conversation function ideaConversation(conversation, ctx):
  Step 1 — create story and generate questions (side effect, wrapped in conversation.external):
    const { storyId, questions } = await conversation.external(async () => {
      const { seedText, universeId } = pendingSeeds.get(ctx.from!.id)!
      pendingSeeds.delete(ctx.from!.id)

      const ideaPayload = deriveIdeaFromMessage(seedText, universeId)
      await db.insert(storyIdeas).values({ ...ideaPayload, status: 'approved', approvedAt: new Date() })

      const [newStory] = await db.insert(stories).values({
        groupId: universeId, seed: seedText, status: 'draft', mode: 'manual', source: 'agent'
      }).returning({ id: stories.id })
      const storyId = newStory!.id

      const [universe] = await db.select().from(storyGroups).where(eq(storyGroups.id, universeId))
      const sashaContext = await synthesizeSashaContext()
      const models = await resolvePipelineModels(universeId, {})

      const questions = await runQuestionsPhase({
        seed: seedText, storyId, models,
        universeSystemPrompt: universe?.systemPrompt,
        universeContext: universe?.universeContext ?? undefined,
        sashaContext,
      })

      await db.delete(planQuestions).where(eq(planQuestions.storyId, storyId))
      await db.insert(planQuestions).values(
        questions.map(q => ({ storyId, questionText: q.question, answerOptions: q.options ?? [] }))
      )
      setPipelineStatus(storyId, 'questions_pending')

      return { storyId, questions }
    })

  Step 2 — ask questions one by one:
    const answers: Array<{ question: string; answer: string }> = []
    for (const q of questions) {
      if (q.options && q.options.length > 0) {
        // show options as inline buttons
        const kb = new InlineKeyboard()
        q.options.forEach(opt => kb.text(opt, `ans:${opt}`).row())
        await ctx.reply(q.question, { reply_markup: kb })
        const ansCtx = await conversation.waitFor('callback_query:data')
        await ansCtx.answerCallbackQuery()
        answers.push({ question: q.question, answer: ansCtx.callbackQuery.data.replace(/^ans:/, '') })
      } else {
        await ctx.reply(q.question)
        const ansCtx = await conversation.waitFor('message:text')
        answers.push({ question: q.question, answer: ansCtx.message.text })
      }
    }

  Step 3 — submit answers and trigger pipeline (side effect):
    await conversation.external(async () => {
      const dbQuestions = await db.select().from(planQuestions)
        .where(eq(planQuestions.storyId, storyId))
        .orderBy(asc(planQuestions.createdAt))
      const now = new Date()
      for (let i = 0; i < dbQuestions.length; i++) {
        const answer = answers[i]
        if (dbQuestions[i] && answer) {
          await db.update(planQuestions)
            .set({ answerText: answer.answer, answeredAt: now })
            .where(eq(planQuestions.id, dbQuestions[i]!.id))
        }
      }
      const [storyRow] = await db.select().from(stories).where(eq(stories.id, storyId))
      const seed = storyRow?.seed ?? ''
      const [universe] = await db.select().from(storyGroups)
        .where(eq(storyGroups.id, storyRow?.groupId!))
      triggerPlanPhaseFromAnswers(
        storyId, seed, answers,
        universe?.systemPrompt, universe?.universeContext ?? undefined, universe?.styleGuide ?? undefined,
        storyRow?.groupId ?? null
      )
    })

  Step 4:
    await ctx.reply(`История #${storyId} создана, пайплайн запущен ✓`)
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
