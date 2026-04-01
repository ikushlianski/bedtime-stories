import { z } from 'zod'

export const PsychologistOutputSchema = z.object({
  safety: z.object({
    verdict: z.enum(['safe', 'concern', 'block']),
    issues: z.array(z.string()),
  }),
  therapeutic: z.object({
    score: z.number().int().min(1).max(5),
    strengths: z.array(z.string()),
    gaps: z.array(z.string()),
  }),
  recommended_changes: z.array(z.string()),
})

export const CriticOutputSchema = z.object({
  issues: z.array(
    z.object({
      prio: z.enum(['must', 'nice']),
      description: z.string(),
      quote: z.string().optional(),
    }),
  ),
  improvement_needed: z.boolean(),
})

export type PsychologistOutput = z.infer<typeof PsychologistOutputSchema>
export type CriticOutput = z.infer<typeof CriticOutputSchema>
