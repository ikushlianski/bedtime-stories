import { z } from 'zod'
import type { ToolDefinition } from '../openrouter/tool-types.js'

export type ThinkingConfig =
  | { type: 'enabled'; budgetTokens?: number }
  | { type: 'adaptive' }
  | { type: 'disabled' }

export interface RunTextOptions {
  model: string
  prompt: string
  cwd?: string
  label?: string
  temperature?: number
  thinking?: ThinkingConfig
  onChunk?: (chunk: string) => void
  onChunkReset?: () => void
  fallback?: string
  storyId?: number
  stage?: string
  tools?: ToolDefinition[]
  executeTool?: (name: string, argsJson: string) => Promise<unknown>
  maxToolIterations?: number
}

export interface RunStructuredOptions<T> {
  skill: string
  model: string
  prompt: string
  outputSchema: z.ZodType<T>
  cwd?: string
  thinking?: ThinkingConfig
  fallback?: string
  storyId?: number
  stage?: string
}

export interface AiRunner {
  runText(options: RunTextOptions): Promise<string>
  runStructured<T>(options: RunStructuredOptions<T>): Promise<T>
}
