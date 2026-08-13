import { z } from 'zod'

export const sendMessageSchema = z.object({
  message: z.string().min(1).max(2000, 'Слишком длинное сообщение (максимум 2000 символов)'),
  selectedText: z.string().optional(),
  context: z.enum(['plan', 'text']).optional(),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>
