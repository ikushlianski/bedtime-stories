export type ValidateWriterOutputResult =
  | { valid: true }
  | { valid: false; reason: string }

const MIN_WORD_COUNT = 400

const META_OPENING_PATTERNS: RegExp[] = [
  /^\s*Вот\s+(несколько|пару|пара|список|немного)\s+(вариант|идей|предложени|мысл|способ)/i,
  /^\s*Вот\s+(мои|некоторые)\s+(идеи|варианты|мысли|предложения)/i,
  /^\s*(Можно|Давай)\s+(рассмотреть|выбрать)\s+(один\s+из\s+)?(вариант|нескольк)/i,
  /^\s*Какие\s+у\s+тебя\s+есть\s+идеи/i,
]

const CHOICE_PROMPT_PATTERNS: RegExp[] = [
  /какой\s+(из\s+)?вариант(ов)?\s+(тебе\s+)?(больше\s+)?нравится/i,
  /выбери(те)?\s+один\s+из/i,
  /дай\s+знать,?\s+какой/i,
  /напиши,?\s+какой\s+вариант/i,
  /какой\s+вариант\s+(тебе\s+)?выбрать/i,
]

function countOptionHeaders(text: string): number {
  const pattern = /(?:^|\n)\s*(?:Вариант|Option)\s*[A-ZА-Я0-9]+\s*[.:)]/gim

  return text.match(pattern)?.length ?? 0
}

export function validateWriterOutput(text: string): ValidateWriterOutputResult {
  const trimmed = text.trim()
  const wordCount = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length

  if (wordCount < MIN_WORD_COUNT) {
    return {
      valid: false,
      reason: `output is only ${wordCount} word(s), far below the 800-1200 word target for a finished story (expected at least ${MIN_WORD_COUNT})`,
    }
  }

  const optionHeaderCount = countOptionHeaders(trimmed)

  if (optionHeaderCount >= 2) {
    return {
      valid: false,
      reason: `output reads like a list of proposed options rather than a finished story (found ${optionHeaderCount} "Вариант/Option" section headers)`,
    }
  }

  if (META_OPENING_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return {
      valid: false,
      reason: 'output opens with meta-discussion addressed to the reader ("here are some options/ideas") instead of story prose',
    }
  }

  if (CHOICE_PROMPT_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return {
      valid: false,
      reason: 'output asks the reader to pick between alternatives instead of committing to a finished story',
    }
  }

  return { valid: true }
}
