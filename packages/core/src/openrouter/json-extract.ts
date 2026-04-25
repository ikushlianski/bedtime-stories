import { z } from 'zod'

export function extractBalancedObject(raw: string): string | null {
  const start = raw.indexOf('{')

  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < raw.length; i++) {
    const c = raw[i]

    if (escape) {
      escape = false
      continue
    }

    if (c === '\\') {
      escape = true
      continue
    }

    if (c === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (c === '{') {
      depth++
    } else if (c === '}') {
      depth--

      if (depth === 0) {
        return raw.slice(start, i + 1)
      }
    }
  }

  return null
}

export function* jsonCandidates(raw: string): Iterable<string> {
  const jsonFenced = raw.matchAll(/```json\s*([\s\S]*?)```/g)

  for (const match of jsonFenced) {
    const candidate = match[1]?.trim()

    if (candidate !== undefined && candidate.length > 0) yield candidate
  }

  const plainFenced = raw.matchAll(/```\s*([\s\S]*?)```/g)

  for (const match of plainFenced) {
    const candidate = match[1]?.trim()

    if (candidate !== undefined && candidate.length > 0) yield candidate
  }

  const balanced = extractBalancedObject(raw)

  if (balanced !== null) yield balanced

  const trimmed = raw.trim()

  if (trimmed.length > 0) yield trimmed
}

export function parseJsonWithSchema<T>(
  rawText: string,
  schema: z.ZodType<T>,
): { ok: true; value: T } | { ok: false; error: unknown } {
  let lastError: unknown

  for (const candidate of jsonCandidates(rawText)) {
    let parsed: unknown

    try {
      parsed = JSON.parse(candidate)
    } catch (err) {
      lastError = err
      continue
    }

    const validated = schema.safeParse(parsed)

    if (validated.success) {
      return { ok: true, value: validated.data }
    }

    lastError = validated.error
  }

  return { ok: false, error: lastError }
}
