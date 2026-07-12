import { z } from 'zod'

const parentReviewInputSchema = z.object({
  rating: z.number().nullable(),
  pacingOk: z.boolean().nullable(),
  wouldReuse: z.boolean().nullable(),
  notes: z.string().nullable(),
})

const parentAnnotationInputSchema = z.object({
  type: z.enum([
    'sasha_reaction',
    'my_note',
    'sasha_laughed',
    'sasha_loved',
    'sasha_disliked',
  ]),
  selectedText: z.string(),
  noteText: z.string().nullable(),
})

export const parentFeedbackInputSchema = z.object({
  review: parentReviewInputSchema.nullable(),
  annotations: z.array(parentAnnotationInputSchema),
})

export type ParentFeedbackInput = z.infer<typeof parentFeedbackInputSchema>

function formatReviewLines(review: ParentFeedbackInput['review']): string[] {
  if (!review) return []

  const lines: string[] = []

  if (review.rating !== null) {
    lines.push(`Оценка родителя: ${review.rating} из 5`)
  }

  if (review.pacingOk === false) {
    lines.push('Родитель: темп истории был неудачным')
  } else if (review.pacingOk === true) {
    lines.push('Родитель: темп истории был хорошим')
  }

  if (review.wouldReuse === false) {
    lines.push('Родитель НЕ переиспользовал бы эту историю')
  } else if (review.wouldReuse === true) {
    lines.push('Родитель переиспользовал бы эту историю')
  }

  const trimmedNotes = review.notes?.trim() ?? ''

  if (trimmedNotes) {
    lines.push(`Заметка родителя: ${trimmedNotes}`)
  }

  return lines
}

function formatAnnotationLine(
  annotation: ParentFeedbackInput['annotations'][number],
): string | null {
  const quote = `«${annotation.selectedText}»`
  const note = annotation.noteText?.trim() ?? ''
  const suffix = note ? ` — ${note}` : ''

  switch (annotation.type) {
    case 'sasha_disliked':
      return `Родителю не понравилось: ${quote}${suffix}`
    case 'sasha_loved':
      return `Ребёнку очень понравилось: ${quote}${suffix}`
    case 'sasha_laughed':
      return `Ребёнок засмеялся здесь: ${quote}${suffix}`
    case 'sasha_reaction':
      return `Реакция ребёнка: ${quote}${suffix}`
    case 'my_note':
      if (!note) return null

      return `Заметка родителя к фрагменту ${quote}: ${note}`
    default:
      return null
  }
}

export function formatParentFeedback(input: ParentFeedbackInput): string[] {
  const reviewLines = formatReviewLines(input.review)

  const annotationLines = input.annotations
    .map(formatAnnotationLine)
    .filter((line): line is string => line !== null)

  return [...reviewLines, ...annotationLines]
}
