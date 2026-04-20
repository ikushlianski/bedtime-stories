import express from 'express'
import cors from 'cors'
import dns from 'node:dns'
import storiesRouter from './routes/stories'
import feedbackRouter from './routes/feedback'
import promptsRouter from './routes/prompts'
import pipelineRouter from './routes/pipeline'
import dashboardRouter from './routes/dashboard'
import improverRouter from './routes/improver'
import universesRouter from './routes/universes'
import diaryRouter from './routes/diary'
import childProfileRouter from './routes/child-profile'

export const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/stories', storiesRouter)
app.use('/api/stories/:id/feedback', feedbackRouter)
app.use('/api/prompts', promptsRouter)
app.use('/api/pipeline', pipelineRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/improver', improverRouter)
app.use('/api/universes', universesRouter)
app.use('/api/diary', diaryRouter)
app.use('/api/child-profile', childProfileRouter)

dns.setDefaultResultOrder('ipv6first')

const PORT = Number(process.env['PORT'] ?? 8020)
const HOST = process.env['HOST'] ?? '::'

export function startServer(): void {
  app.listen(PORT, HOST, () => {
    console.log(`Server running on [${HOST}]:${PORT}`)
  })
}
