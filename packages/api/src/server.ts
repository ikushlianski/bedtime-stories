import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dns from 'node:dns'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { Sentry } from '@bedtime/observability'
import { scheduleDailyCatalogSync } from '@bedtime/core/queue'
import storiesRouter from './routes/stories'
import storiesSeriesRouter from './routes/stories-series'
import feedbackRouter from './routes/feedback'
import promptsRouter from './routes/prompts'
import pipelineRouter from './routes/pipeline'
import dashboardRouter from './routes/dashboard'
import improverRouter from './routes/improver'
import universesRouter from './routes/universes'
import universeSuggestionsRouter from './routes/universe-suggestions'
import storyIdeasRouter from './routes/story-ideas'
import diaryRouter from './routes/diary'
import fragmentsRouter from './routes/fragments'
import topicsRouter from './routes/topics'
import wordsRouter from './routes/words'
import childProfileRouter from './routes/child-profile'
import modelsRouter from './routes/models'
import storiesSwapModelRouter from './routes/stories-swap-model'
import storiesVfmRouter from './routes/stories-vfm'
import storyCommentsRouter from './routes/story-comments'
import adminRouter from './routes/admin'
import authRouter from './routes/auth.routes'
import settingsRouter from './routes/settings'
import internalCatalogSyncRouter from './routes/internal-catalog-sync'
import internalBackfillRouter from './routes/internal-backfill'
import internalWorkerRouter from './routes/internal-worker'
import internalUniverseMemorySyncRouter from './routes/internal-universe-memory-sync'
import internalEmbedStoryBackfillRouter from './routes/internal-embed-story-backfill'
import { requireAuth } from './middleware/auth.middleware'
import { bot } from './routes/telegram'
import { webhookCallback } from 'grammy'

export const app = express()

const ALLOWED_ORIGINS = (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:8021,http://127.0.0.1:8021')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/_healthz', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRouter)
app.use('/api/internal/catalog-sync', internalCatalogSyncRouter)
app.use('/api/internal/backfill', internalBackfillRouter)
app.use('/api/internal/worker', internalWorkerRouter)
app.use('/api/internal/universe-memory-sync', internalUniverseMemorySyncRouter)
app.use('/api/internal/embed-story-backfill', internalEmbedStoryBackfillRouter)

const useTelegramPolling = !process.env['TELEGRAM_WEBHOOK_URL'] && process.env['TELEGRAM_ENABLE_POLLING'] === 'true'

if (bot && !useTelegramPolling) {
  app.post('/api/telegram/webhook', webhookCallback(bot, 'express'))
}

app.use('/api', requireAuth)

app.use('/api/stories/series', storiesSeriesRouter)
app.use('/api/stories', storiesRouter)
app.use('/api/stories/:id/feedback', feedbackRouter)
app.use('/api/prompts', promptsRouter)
app.use('/api/pipeline', pipelineRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/improver', improverRouter)
app.use('/api/universes', universesRouter)
app.use('/api/universes/:universeId/suggestions', universeSuggestionsRouter)
app.use('/api/universes/:universeId/ideas', storyIdeasRouter)
app.use('/api/diary', diaryRouter)
app.use('/api/fragments', fragmentsRouter)
app.use('/api/topics', topicsRouter)
app.use('/api/words', wordsRouter)
app.use('/api/child-profile', childProfileRouter)
app.use('/api/models', modelsRouter)
app.use('/api/stories/:id/swap-model', storiesSwapModelRouter)
app.use('/api/stories/:id/value-for-money', storiesVfmRouter)
app.use('/api/stories/:id/comments', storyCommentsRouter)
app.use('/api/admin', adminRouter)
app.use('/api/settings', settingsRouter)

Sentry.setupExpressErrorHandler(app)

if (process.env['NODE_ENV'] === 'production') {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const webDist = resolve(__dirname, '../../web/dist')

  app.use(express.static(webDist))
  app.get('{*path}', (_req, res) => {
    res.sendFile(resolve(webDist, 'index.html'))
  })
}

dns.setDefaultResultOrder('ipv6first')

const PORT = Number(process.env['PORT'] ?? 8020)
const HOST = process.env['HOST'] ?? '127.0.0.1'

export function startServer(): void {
  app.listen(PORT, HOST, () => {
    console.log(`Server running on [${HOST}]:${PORT}`)
    scheduleDailyCatalogSync()

    if (!bot) {
      console.log('Telegram bot disabled (no TELEGRAM_BOT_TOKEN)')
      return
    }

    bot.api.setMyCommands([
      { command: 'new', description: 'Новая сказка' },
      { command: 'stories', description: 'Мои сказки' },
      { command: 'start', description: 'Начать' },
    ]).catch((e: unknown) => console.error('Telegram setMyCommands failed:', e))

    const webhookUrl = process.env['TELEGRAM_WEBHOOK_URL']

    if (webhookUrl) {
      bot.api.setWebhook(webhookUrl)
        .then(() => console.log('Telegram webhook set:', webhookUrl))
        .catch((e: unknown) => console.error('Telegram webhook setup failed:', e))
    } else if (process.env['TELEGRAM_ENABLE_POLLING'] === 'true') {
      bot.api.deleteWebhook().catch(() => {})
      bot.start()
      console.log('Telegram bot started in long-polling mode')
    } else {
      console.log(
        'Telegram bot loaded (outbound only). Set TELEGRAM_WEBHOOK_URL for webhook delivery, or TELEGRAM_ENABLE_POLLING=true to long-poll locally.',
      )
    }
  })
}
