import type { Annotation, AnnotationType } from '../lib/api'

export { annotationTypeLabel } from '../components/types'

export function sortAnnotationsByPosition(list: Annotation[]): Annotation[] {
  return [...list].sort((a, b) => {
    const aStart = a.positionStart ?? Number.MAX_SAFE_INTEGER
    const bStart = b.positionStart ?? Number.MAX_SAFE_INTEGER

    if (aStart !== bStart) return aStart - bStart

    return a.id - b.id
  })
}

export function appendAnnotation(list: Annotation[], annotation: Annotation): Annotation[] {
  if (list.some((existing) => existing.id === annotation.id)) return list

  return sortAnnotationsByPosition([...list, annotation])
}

export function countByType(list: Annotation[]): Record<AnnotationType, number> {
  const counts: Record<AnnotationType, number> = {
    sasha_reaction: 0,
    sasha_laughed: 0,
    sasha_loved: 0,
    sasha_disliked: 0,
    my_note: 0,
  }

  for (const annotation of list) {
    counts[annotation.type] += 1
  }

  return counts
}

export function totalReactions(counts: Record<AnnotationType, number>): number {
  return (
    counts.sasha_reaction + counts.sasha_laughed + counts.sasha_loved + counts.sasha_disliked
  )
}
