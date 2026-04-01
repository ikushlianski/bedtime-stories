import { z } from 'zod'

export interface RunTextOptions {
  model: string
  prompt: string
  cwd?: string
}

export interface RunStructuredOptions<T> {
  skill: string
  model: string
  prompt: string
  outputSchema: z.ZodType<T>
  cwd?: string
}

export interface AiRunner {
  runText(options: RunTextOptions): Promise<string>
  runStructured<T>(options: RunStructuredOptions<T>): Promise<T>
}
