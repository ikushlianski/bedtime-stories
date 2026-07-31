// Minimum length (in graphemes) a merged run of sentence-segments must reach before we treat
// it as "the first sentence" — Intl.Segmenter's sentence breaks still split on abbreviations
// like "А. С. Пушкин" into "А. " / "С. " / "Пушкин ...", so short fragments get folded into
// the next one until the result is substantial.
const MIN_SENTENCE_LENGTH = 12

const sentenceSegmenter = new Intl.Segmenter('ru', { granularity: 'sentence' })
const graphemeSegmenter = new Intl.Segmenter('ru', { granularity: 'grapheme' })

function graphemes(text: string): string[] {
  return [...graphemeSegmenter.segment(text)].map((s) => s.segment)
}

function deriveFirstSentence(trimmed: string): string {
  let preview = ''

  for (const { segment } of sentenceSegmenter.segment(trimmed)) {
    preview += segment

    if (graphemes(preview.trim()).length >= MIN_SENTENCE_LENGTH) {
      break
    }
  }

  return preview.trim() || trimmed
}

export function deriveTitlePreview(seed: string, maxLength: number): string {
  const trimmed = seed.trim()

  if (!trimmed) {
    return ''
  }

  const firstSentence = deriveFirstSentence(trimmed)

  if (graphemes(firstSentence).length <= maxLength) {
    return firstSentence
  }

  const truncated = graphemes(trimmed).slice(0, maxLength).join('')
  const lastSpace = truncated.lastIndexOf(' ')
  const cut = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated

  return `${cut.trimEnd()}…`
}
