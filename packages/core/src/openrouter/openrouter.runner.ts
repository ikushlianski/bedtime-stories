import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { modelCatalog } from '../db/schema.js'
import { env } from '../env.js'
import type { AiRunner, RunStructuredOptions, RunTextOptions } from '../ai/runner.interface.js'
import { OpenRouterClient, OpenRouterHttpError, type OpenRouterUsage } from './openrouter.client.js'
import { parseJsonWithSchema } from './json-extract.js'
import { deriveStructuredRequestPayload } from './derive-structured-request-payload.js'
import { costRecorder, type CostRecorder } from '../cost/cost-recorder.js'
import { langfuse, getActiveTraceId } from '@bedtime/observability'

const SYSTEM_PROMPT =
  'You are an AI assistant following the instructions in the user message exactly. Do not introduce yourself, do not explain what you are about to do, and do not add trailing commentary. Produce only the output the user asked for.'

const MAX_VALIDATION_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 1500

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

export function isRetryable(err: unknown): boolean {
  if (err instanceof OpenRouterHttpError) {
    return err.status === 429 || err.status === 529 || (err.status >= 500 && err.status < 600)
  }

  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  return (
    message.includes('timeout') ||
    message.includes('econn') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('socket')
  )
}

const SKILLS_DIR = join(import.meta.dirname, '../skills')

const skillCache = new Map<string, string | null>()

async function loadSkillBody(skillName: string): Promise<string | null> {
  const cached = skillCache.get(skillName)

  if (cached !== undefined) return cached

  const path = join(SKILLS_DIR, `${skillName}.md`)

  try {
    const raw = await readFile(path, 'utf-8')
    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
    skillCache.set(skillName, body)
    return body
  } catch {
    skillCache.set(skillName, null)
    return null
  }
}

const supportsJsonSchemaCache = new Map<string, boolean>()

async function lookupSupportsJsonSchema(modelId: string): Promise<boolean> {
  const cached = supportsJsonSchemaCache.get(modelId)
  if (cached !== undefined) return cached

  const rows = await db.select().from(modelCatalog).where(eq(modelCatalog.id, modelId)).limit(1)
  const supports = rows[0]?.supportsJsonSchema ?? false
  supportsJsonSchemaCache.set(modelId, supports)
  return supports
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function deriveStage(label: string | undefined, skill: string | undefined): string {
  if (skill !== undefined) return skill
  if (label === undefined) return 'unknown'
  return label.split(':')[0] ?? label
}

export class OpenRouterRunner implements AiRunner {
  constructor(
    private readonly client: OpenRouterClient = new OpenRouterClient(env.OPENROUTER_API_KEY),
    private readonly recorder: CostRecorder = costRecorder,
  ) {}

  async runText(options: RunTextOptions): Promise<string> {
    const label = options.label ?? 'runText'
    const stage = options.stage ?? deriveStage(options.label, undefined)
    const candidates = options.fallback !== undefined ? [options.model, options.fallback] : [options.model]

    const generation = langfuse.generation({
      name: label,
      model: options.model,
      input: options.prompt,
      metadata: { stage },
      traceId: getActiveTraceId() ?? null,
    })

    let lastErr: unknown

    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i]!
      const fallbackUsed = i > 0
      const startedAt = Date.now()

      console.log(`[ai] ${label} start model=${model} promptLen=${options.prompt.length} attempt=${i + 1}/${candidates.length} fallbackUsed=${fallbackUsed}`)

      if (fallbackUsed) {
        console.warn(`[ai] fallback activated label=${label} from-model=${candidates[0]} to-model=${model} reason=${(lastErr as Error)?.message ?? 'unknown'}`)
        options.onChunkReset?.()
      }

      let collected = ''
      let usage: OpenRouterUsage = { promptTokens: 0, completionTokens: 0, costUsd: 0 }

      try {
        for await (const ev of this.client.chatStream({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: options.prompt },
          ],
        })) {
          if (ev.delta !== undefined) {
            collected += ev.delta
            options.onChunk?.(ev.delta)
          }

          if (ev.usage !== undefined) usage = ev.usage
        }

        const latencyMs = Date.now() - startedAt
        console.log(`[ai] ${label} done model=${model} stage=${stage} tokensIn=${usage.promptTokens} tokensOut=${usage.completionTokens} usd=${usage.costUsd} latencyMs=${latencyMs} attempt=${i + 1}`)

        await this.recorder.record({
          storyId: options.storyId ?? null,
          stage,
          modelId: model,
          attempt: i + 1,
          fallbackUsed,
          tokensIn: usage.promptTokens,
          tokensOut: usage.completionTokens,
          usd: usage.costUsd,
          latencyMs,
          success: true,
        })

        if (collected === '') throw new AiExecutionError('no result received')

        generation.end({
          output: collected,
          usage: {
            input: usage.promptTokens,
            output: usage.completionTokens,
            unit: 'TOKENS',
          },
        })

        return collected
      } catch (err) {
        const latencyMs = Date.now() - startedAt
        lastErr = err

        await this.recorder.record({
          storyId: options.storyId ?? null,
          stage,
          modelId: model,
          attempt: i + 1,
          fallbackUsed,
          tokensIn: usage.promptTokens,
          tokensOut: usage.completionTokens,
          usd: usage.costUsd,
          latencyMs,
          success: false,
        })

        if (i + 1 < candidates.length && isRetryable(err)) {
          console.warn(`[ai] ${label} retryable failure model=${model}, switching to fallback:`, err)
          continue
        }

        console.error(`[ai] ${label} failed model=${model} latencyMs=${latencyMs}:`, err)

        generation.end({ level: 'ERROR', statusMessage: String(err) })

        throw err
      }
    }

    generation.end({ level: 'ERROR', statusMessage: 'no candidates available' })

    throw lastErr ?? new AiExecutionError('no candidates available')
  }

  async runStructured<T>(options: RunStructuredOptions<T>): Promise<T> {
    const stage = options.stage ?? options.skill
    const label = `skill:${options.skill}`
    const skillBody = await loadSkillBody(options.skill)
    const userPrompt = skillBody
      ? [
          `You are operating under the "${options.skill}" skill. Follow its instructions precisely and respond with the exact JSON shape the skill specifies.`,
          '',
          '=== SKILL INSTRUCTIONS ===',
          skillBody,
          '=== END SKILL INSTRUCTIONS ===',
          '',
          '=== INPUT ===',
          options.prompt,
        ].join('\n')
      : options.prompt

    const generation = langfuse.generation({
      name: options.skill,
      model: options.model,
      input: userPrompt,
      metadata: { stage },
      traceId: getActiveTraceId() ?? null,
    })

    const candidates = options.fallback !== undefined ? [options.model, options.fallback] : [options.model]
    let lastErr: unknown

    for (let candidateIdx = 0; candidateIdx < candidates.length; candidateIdx++) {
      const model = candidates[candidateIdx]!
      const fallbackUsed = candidateIdx > 0

      if (fallbackUsed) {
        console.warn(`[ai] fallback activated label=${label} from-model=${candidates[0]} to-model=${model} reason=${(lastErr as Error)?.message ?? 'unknown'}`)
      }

      const supportsJsonSchema = await lookupSupportsJsonSchema(model)
      const payload = deriveStructuredRequestPayload({
        model,
        supportsJsonSchema,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        schema: options.outputSchema,
        schemaName: options.skill.replace(/[^a-z0-9_]/gi, '_'),
      })

      let lastValidation: { raw: string; error: unknown } | null = null

      for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
        const startedAt = Date.now()

        try {
          const result = await this.client.chatNonStream({
            model: payload.model,
            messages: payload.messages,
            ...(payload.response_format !== undefined ? { response_format: payload.response_format } : {}),
          })

          const latencyMs = Date.now() - startedAt
          const parsed = parseJsonWithSchema(result.text, options.outputSchema)

          await this.recorder.record({
            storyId: options.storyId ?? null,
            stage: stage ?? 'unknown',
            modelId: model,
            attempt,
            fallbackUsed,
            tokensIn: result.usage.promptTokens,
            tokensOut: result.usage.completionTokens,
            usd: result.usage.costUsd,
            latencyMs,
            success: parsed.ok,
          })

          if (parsed.ok) {
            console.log(`[ai] ${label} done model=${model} stage=${stage} usd=${result.usage.costUsd} latencyMs=${latencyMs} attempt=${attempt}`)

            generation.end({
              output: parsed.value,
              usage: {
                input: result.usage.promptTokens,
                output: result.usage.completionTokens,
                unit: 'TOKENS',
              },
            })

            return parsed.value
          }

          lastValidation = { raw: result.text, error: parsed.error }

          if (attempt < MAX_VALIDATION_ATTEMPTS) {
            const backoff = RETRY_BASE_DELAY_MS * attempt
            console.warn(`[ai] ${label} invalid JSON attempt=${attempt} parseError=`, parsed.error)
            await sleep(backoff)
            continue
          }
        } catch (err) {
          const latencyMs = Date.now() - startedAt

          await this.recorder.record({
            storyId: options.storyId ?? null,
            stage: stage ?? 'unknown',
            modelId: model,
            attempt,
            fallbackUsed,
            tokensIn: 0,
            tokensOut: 0,
            usd: 0,
            latencyMs,
            success: false,
          })

          lastErr = err

          if (isRetryable(err)) {
            if (candidateIdx + 1 < candidates.length) {
              break
            }

            if (attempt < MAX_VALIDATION_ATTEMPTS) {
              const backoff = RETRY_BASE_DELAY_MS * attempt
              console.warn(`[ai] ${label} retryable failure attempt=${attempt}, retrying in ${backoffMsLabel(backoff)}:`, err)
              await sleep(backoff)
              continue
            }
          }

          generation.end({ level: 'ERROR', statusMessage: String(err) })

          throw err
        }
      }

      if (lastValidation !== null && candidateIdx + 1 === candidates.length) {
        generation.end({ level: 'ERROR', statusMessage: String(lastValidation.error) })
        throw new AiValidationError(lastValidation.raw, lastValidation.error)
      }
    }

    generation.end({ level: 'ERROR', statusMessage: 'no candidates available' })

    throw lastErr ?? new AiExecutionError('no candidates available')
  }
}

function backoffMsLabel(ms: number): string {
  return `${ms}ms`
}
