import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { AiRunner, RunStructuredOptions, RunTextOptions } from './runner.interface'

const skillCache = new Map<string, string>()
let cachedSkillsRoot: string | null = null

function findSkillsRoot(startDir: string): string {
  let dir = resolve(startDir)

  while (true) {
    if (existsSync(join(dir, '.claude', 'skills'))) {
      return dir
    }

    const parent = dirname(dir)

    if (parent === dir) {
      throw new Error(`Could not find .claude/skills directory walking up from ${startDir}`)
    }

    dir = parent
  }
}

async function loadSkillBody(skillName: string, startDir: string): Promise<string> {
  if (cachedSkillsRoot === null) {
    cachedSkillsRoot = findSkillsRoot(startDir)
  }

  const cacheKey = `${cachedSkillsRoot}::${skillName}`
  const cached = skillCache.get(cacheKey)
  if (cached !== undefined) return cached

  const path = join(cachedSkillsRoot, '.claude', 'skills', skillName, 'SKILL.md')
  const raw = await readFile(path, 'utf-8')
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
  skillCache.set(cacheKey, body)
  return body
}

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

const MAX_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 1500

function isRetryable(err: unknown): boolean {
  if (err instanceof AiValidationError) return false
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return (
    message.includes('timeout') ||
    message.includes('econn') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('socket') ||
    message.includes('rate') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('529')
  )
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class ClaudeCliRunner implements AiRunner {
  async runText(options: RunTextOptions): Promise<string> {
    const { model, prompt } = options
    const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
    const label = options.label ?? 'runText'

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const startedAt = Date.now()
      console.log(`[ai] ${label} start model=${model} promptLen=${prompt.length} attempt=${attempt}/${MAX_ATTEMPTS}`)

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
        console.log(`[ai] ${label} done model=${model} durationMs=${durationMs} resultLen=${resultText.length} attempt=${attempt}`)

        return resultText
      } catch (err) {
        const durationMs = Date.now() - startedAt
        const retryable = isRetryable(err) && attempt < MAX_ATTEMPTS

        if (retryable) {
          const backoffMs = RETRY_BASE_DELAY_MS * attempt
          console.warn(`[ai] ${label} transient failure model=${model} durationMs=${durationMs} attempt=${attempt}, retrying in ${backoffMs}ms:`, err)
          await sleep(backoffMs)
          continue
        }

        console.error(`[ai] ${label} failed model=${model} durationMs=${durationMs} attempt=${attempt}:`, err)
        throw err
      }
    }

    throw new AiExecutionError(`exhausted ${MAX_ATTEMPTS} attempts`)
  }

  async runStructured<T>(options: RunStructuredOptions<T>): Promise<T> {
    const { skill, model, prompt, outputSchema } = options
    const cwdArg = options.cwd !== undefined ? { cwd: options.cwd } : {}
    const skillCwd = options.cwd ?? process.cwd()

    const skillBody = await loadSkillBody(skill, skillCwd)
    const fullPrompt = [
      `You are operating under the "${skill}" skill. Follow its instructions precisely and respond with the exact JSON shape the skill specifies.`,
      '',
      '=== SKILL INSTRUCTIONS ===',
      skillBody,
      '=== END SKILL INSTRUCTIONS ===',
      '',
      '=== INPUT ===',
      prompt,
      '',
      'Return ONLY the JSON output described in the skill. No prose, no markdown fence, no commentary.',
    ].join('\n')

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
