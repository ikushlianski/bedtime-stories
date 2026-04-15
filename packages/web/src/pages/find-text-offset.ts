export interface TextOffset {
  start: number
  end: number
}

export function findTextOffset(fullText: string, selectedText: string): TextOffset | null {
  if (selectedText.length === 0) return null

  const index = fullText.indexOf(selectedText)

  if (index === -1) return null

  return { start: index, end: index + selectedText.length }
}

export function findTextOffsetNear(
  fullText: string,
  selectedText: string,
  hint: number,
): TextOffset | null {
  if (selectedText.length === 0) return null

  const first = fullText.indexOf(selectedText)

  if (first === -1) return null

  let best = first
  let bestDistance = Math.abs(first - hint)
  let searchFrom = first + 1

  while (true) {
    const next = fullText.indexOf(selectedText, searchFrom)

    if (next === -1) break

    const distance = Math.abs(next - hint)

    if (distance < bestDistance) {
      best = next
      bestDistance = distance
    }

    searchFrom = next + 1
  }

  return { start: best, end: best + selectedText.length }
}
