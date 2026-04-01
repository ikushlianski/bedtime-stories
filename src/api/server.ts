import express from 'express'
import cors from 'cors'
import storiesRouter from './routes/stories'
import feedbackRouter from './routes/feedback'
import promptsRouter from './routes/prompts'
import pipelineRouter from './routes/pipeline'
import dashboardRouter from './routes/dashboard'

export const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/stories', storiesRouter)
app.use('/api/stories/:id/feedback', feedbackRouter)
app.use('/api/prompts', promptsRouter)
app.use('/api/pipeline', pipelineRouter)
app.use('/api/dashboard', dashboardRouter)

const PORT = process.env['PORT'] ?? 3001

export function startServer(): void {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}
