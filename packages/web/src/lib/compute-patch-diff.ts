import { diffWords } from 'diff'

export interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

const russianWordSegmenter = new Intl.Segmenter('ru', { granularity: 'word' })

export function computePatchDiff(original: string, patched: string): DiffSegment[] {
  const changes = diffWords(original, patched, { intlSegmenter: russianWordSegmenter })

  return changes.map((change) => ({
    type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
    text: change.value,
  }))
}
