import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  NOTION_TOKEN: z.string().optional(),
  NOTION_DATABASE_ID: z.string().optional(),
})

export const env = envSchema.parse(process.env)
