const SENTENCE_END = /^[^.!?]*[.!?]/

export function deriveTitlePreview(seed: string, maxLength: number): string {
  const trimmed = seed.trim()

  if (!trimmed) {
    return ''
  }

  const sentenceMatch = trimmed.match(SENTENCE_END)
  const firstSentence = sentenceMatch ? sentenceMatch[0].trim() : trimmed

  if (firstSentence.length <= maxLength) {
    return firstSentence
  }

  const truncated = trimmed.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  const cut = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated

  return `${cut.trimEnd()}…`
}
