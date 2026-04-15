import { claudeCode } from 'ai-sdk-provider-claude-code'
import type { MastraModelConfig } from '@mastra/core/llm'

export type ClaudeCliModelId = 'sonnet' | 'opus' | 'haiku'

export const claudeCliModel = (
  modelId: ClaudeCliModelId = 'sonnet',
): MastraModelConfig => {
  return claudeCode(modelId)
}
