import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { PostgresStore, PgVector } from '@mastra/pg'
import { env } from '../../env'

const memory = new Memory({
  storage: new PostgresStore({
    id: 'bedtime-story-storage',
    connectionString: env.DATABASE_URL,
  }),
  vector: new PgVector({
    id: 'bedtime-story-vector',
    connectionString: env.DATABASE_URL,
  }),
  options: {
    lastMessages: 20,
    semanticRecall: {
      topK: 5,
      messageRange: 3,
    },
    workingMemory: {
      enabled: true,
    },
  },
})

export const storyPlaceholderAgent = new Agent({
  id: 'story-placeholder',
  name: 'Story Placeholder',
  instructions: 'Placeholder agent for the bedtime story pipeline.',
  model: 'anthropic/claude-sonnet-4-5',
  memory,
})
