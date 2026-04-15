export type DiffLineType = 'added' | 'removed' | 'unchanged'

export interface DiffLine {
  type: DiffLineType
  text: string
}

function longestCommonSubsequenceMatrix(a: string[], b: string[]): number[][] {
  const rows = a.length + 1
  const cols = b.length + 1
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i]![j] = table[i - 1]![j - 1]! + 1
      } else {
        const up = table[i - 1]![j]!
        const left = table[i]![j - 1]!
        table[i]![j] = up >= left ? up : left
      }
    }
  }

  return table
}

export function computeLineDiff(original: string, revised: string): DiffLine[] {
  const originalLines = original === '' ? [] : original.split('\n')
  const revisedLines = revised === '' ? [] : revised.split('\n')

  const table = longestCommonSubsequenceMatrix(originalLines, revisedLines)

  const result: DiffLine[] = []
  let i = originalLines.length
  let j = revisedLines.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === revisedLines[j - 1]) {
      result.push({ type: 'unchanged', text: originalLines[i - 1]! })
      i--
      j--
      continue
    }

    const up = i > 0 ? table[i - 1]![j]! : -1
    const left = j > 0 ? table[i]![j - 1]! : -1

    if (j > 0 && left >= up) {
      result.push({ type: 'added', text: revisedLines[j - 1]! })
      j--
    } else {
      result.push({ type: 'removed', text: originalLines[i - 1]! })
      i--
    }
  }

  return result.reverse()
}
