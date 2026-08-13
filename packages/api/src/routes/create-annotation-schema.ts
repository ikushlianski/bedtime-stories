import { z } from 'zod'

export const createAnnotationSchema = z.object({
  type: z.enum(['sasha_reaction', 'my_note', 'sasha_laughed', 'sasha_loved', 'sasha_disliked']),
  selected_text: z.string().min(1).max(2000, 'Слишком большой фрагмент текста (максимум 2000 символов)').optional(),
  note_text: z.string().max(2000, 'Слишком длинная заметка (максимум 2000 символов)').optional(),
  position_start: z.number().int().nonnegative().optional(),
  position_end: z.number().int().nonnegative().optional(),
  context: z.enum(['plan', 'text']).optional(),
})

export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>
