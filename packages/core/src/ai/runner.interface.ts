import { z } from 'zod'

export type ThinkingConfig =
  | { type: 'enabled'; budgetTokens?: number }
  | { type: 'adaptive' }
  | { type: 'disabled' }

export interface RunTextOptions {
  model: string
  prompt: string
  cwd?: string
  label?: string
  thinking?: ThinkingConfig
}

export interface RunStructuredOptions<T> {
  skill: string
  model: string
  prompt: string
  outputSchema: z.ZodType<T>
  cwd?: string
  thinking?: ThinkingConfig
}

export interface AiRunner {
  runText(options: RunTextOptions): Promise<string>
  runStructured<T>(options: RunStructuredOptions<T>): Promise<T>
}
