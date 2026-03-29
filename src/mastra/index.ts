import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { PostgresStore } from '@mastra/pg'
import { env } from '../env'
import { storyPlaceholderAgent } from './agents/story-placeholder.agent'

export const mastra = new Mastra({
  agents: {
    storyPlaceholderAgent,
  },
  storage: new PostgresStore({
    id: 'mastra-storage',
    connectionString: env.DATABASE_URL,
  }),
  logger: new PinoLogger({
    name: 'BedtimeAgent',
    level: 'info',
  }),
})
