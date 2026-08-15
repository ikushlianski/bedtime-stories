export type ResolveTargetInTextResult =
  | { ok: true; resolvedTarget: string }
  | { ok: false }

function escapeForRegex(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildFlexiblePattern(target: string): RegExp | null {
  const words = target.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) return null

  return new RegExp(words.map(escapeForRegex).join('\\s+'))
}

export function resolveTargetInText(currentText: string, target: string): ResolveTargetInTextResult {
  const trimmedTarget = target.trim()

  if (!trimmedTarget) return { ok: false }

  if (currentText.includes(trimmedTarget)) {
    return { ok: true, resolvedTarget: trimmedTarget }
  }

  const pattern = buildFlexiblePattern(trimmedTarget)

  if (!pattern) return { ok: false }

  const match = currentText.match(pattern)

  if (!match) return { ok: false }

  return { ok: true, resolvedTarget: match[0] }
}
