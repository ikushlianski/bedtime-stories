export interface TextLine {
  index: number
  text: string
  isBlock: boolean
}

export interface TextBlock {
  index: number
  text: string
}

function isTitleLine(text: string): boolean {
  const trimmed = text.trim()

  return /^\*\*[^*]+\*\*$/.test(trimmed) || /^#+\s/.test(trimmed)
}

export function splitTextIntoLines(text: string): TextLine[] {
  const rawLines = text.split('\n')
  const firstNonEmptyIndex = rawLines.findIndex((line) => line.trim() !== '')
  const titleIndex =
    firstNonEmptyIndex !== -1 && isTitleLine(rawLines[firstNonEmptyIndex]) ? firstNonEmptyIndex : -1

  return rawLines.map((lineText, index) => ({
    index,
    text: lineText,
    isBlock: lineText.trim() !== '' && index !== titleIndex,
  }))
}

export function splitTextIntoBlocks(text: string): TextBlock[] {
  return splitTextIntoLines(text)
    .filter((line) => line.isBlock)
    .map(({ index, text }) => ({ index, text }))
}
