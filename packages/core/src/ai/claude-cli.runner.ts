import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { AiRunner, RunStructuredOptions, RunTextOptions } from './runner.interface'

export class AiExecutionError extends Error {
  constructor(readonly detail: string) {
    super(`AI execution failed: ${detail}`)
  }
}

export class AiValidationError extends Error {
  constructor(
    readonly raw: string,
    readonly parseError: unknown,
  ) {
    super('AI returned invalid JSON output')
  }
}

export class ClaudeCliRunner implements AiRunner {
  async runText(options: RunTextOptions): Promise<string> {
    const { model, prompt } = options
    const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

    const startedAt = Date.now()
    const label = options.label ?? 'runText'
    console.log(`[ai] ${label} start model=${model} promptLen=${prompt.length}`)

    let resultText = ''

    try {
      const messages = query({
        prompt,
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
          if (msg.subtype !== 'success') {
            throw new AiExecutionError(`subtype=${msg.subtype}`)
          }

          resultText = msg.result
        }
      }

      if (!resultText) {
        throw new AiExecutionError('no result received')
      }

      const durationMs = Date.now() - startedAt
      console.log(`[ai] ${label} done model=${model} durationMs=${durationMs} resultLen=${resultText.length}`)

      return resultText
    } catch (err) {
      const durationMs = Date.now() - startedAt
      console.error(`[ai] ${label} failed model=${model} durationMs=${durationMs}:`, err)
      throw err
    }
  }

  async runStructured<T>(options: RunStructuredOptions<T>): Promise<T> {
    const { skill, model, prompt, outputSchema } = options
    const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}

    const fullPrompt = `/${skill}\n\n${prompt}`
    const resultText = await this.runText({ model, prompt: fullPrompt, label: `skill:${skill}`, ...cwdArg })

    const jsonText = this.extractJson(resultText)

    let parsed: unknown

    try {
      parsed = JSON.parse(jsonText)
    } catch (err) {
      throw new AiValidationError(resultText, err)
    }

    const validated = outputSchema.safeParse(parsed)

    if (!validated.success) {
      throw new AiValidationError(resultText, validated.error)
    }

    return validated.data
  }

  private extractJson(raw: string): string {
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
}
