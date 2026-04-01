import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

class AgentValidationError extends Error {
  constructor(
    public readonly skillName: string,
    public readonly raw: string,
    public readonly parseError: unknown,
  ) {
    super(`Agent "${skillName}" returned invalid JSON output`)
  }
}

class AgentExecutionError extends Error {
  constructor(
    public readonly skillName: string,
    public readonly detail: string,
  ) {
    super(`Agent "${skillName}" execution failed: ${detail}`)
  }
}

function extractJsonFromResult(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)

  if (fenceMatch?.[1] !== undefined) {
    return fenceMatch[1].trim()
  }

  const braceStart = raw.indexOf('{')
  const braceEnd = raw.lastIndexOf('}')

  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    return raw.slice(braceStart, braceEnd + 1)
  }

  return raw.trim()
}

export async function runAgent<T>(options: {
  skillName: string
  model: string
  prompt: string
  outputSchema: z.ZodType<T>
  cwd?: string
}): Promise<T> {
  const { skillName, model, prompt, outputSchema } = options
  const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

  const promptWithSkill = `/${skillName}\n\n${prompt}`

  let resultText = ''

  const messages = query({
    prompt: promptWithSkill,
    options: {
      model,
      ...cwdArg,
      tools: [],
      permissionMode: 'dontAsk',
      persistSession: false,
    },
  })

  for await (const msg of messages as AsyncIterable<SDKMessage>) {
    if (msg.type === 'result') {
      if (msg.subtype === 'error_during_execution' || msg.subtype === 'error_max_turns') {
        throw new AgentExecutionError(skillName, `subtype=${msg.subtype}`)
      }

      if (msg.subtype === 'success') {
        resultText = msg.result
      }
    }
  }

  if (!resultText) {
    throw new AgentExecutionError(skillName, 'no result received')
  }

  const jsonText = extractJsonFromResult(resultText)

  let parsed: unknown

  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    throw new AgentValidationError(skillName, resultText, err)
  }

  const validated = outputSchema.safeParse(parsed)

  if (!validated.success) {
    throw new AgentValidationError(skillName, resultText, validated.error)
  }

  return validated.data
}
