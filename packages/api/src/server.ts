import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dns from 'node:dns'
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
import diaryRouter from './routes/diary'
import childProfileRouter from './routes/child-profile'
import modelsRouter from './routes/models'
import storiesSwapModelRouter from './routes/stories-swap-model'
import storiesVfmRouter from './routes/stories-vfm'
import adminRouter from './routes/admin'
import authRouter from './routes/auth.routes'
import { requireAuth } from './middleware/auth.middleware'

export const app = express()

const ALLOWED_ORIGINS = (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:8021,http://127.0.0.1:8021')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)

app.use(requireAuth)

app.use('/api/stories/series', storiesSeriesRouter)
app.use('/api/stories', storiesRouter)
app.use('/api/stories/:id/feedback', feedbackRouter)
app.use('/api/prompts', promptsRouter)
app.use('/api/pipeline', pipelineRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/improver', improverRouter)
app.use('/api/universes', universesRouter)
app.use('/api/universes/:universeId/suggestions', universeSuggestionsRouter)
app.use('/api/diary', diaryRouter)
app.use('/api/child-profile', childProfileRouter)
app.use('/api/models', modelsRouter)
app.use('/api/stories/:id/swap-model', storiesSwapModelRouter)
app.use('/api/stories/:id/value-for-money', storiesVfmRouter)
app.use('/api/admin', adminRouter)

Sentry.setupExpressErrorHandler(app)

dns.setDefaultResultOrder('ipv6first')

const PORT = Number(process.env['PORT'] ?? 8020)
const HOST = process.env['HOST'] ?? '127.0.0.1'

export function startServer(): void {
  app.listen(PORT, HOST, () => {
    console.log(`Server running on [${HOST}]:${PORT}`)
    scheduleDailyCatalogSync()
  })
}
