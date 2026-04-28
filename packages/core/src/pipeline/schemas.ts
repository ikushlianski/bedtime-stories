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

export const ImproverOutputSchema = z.object({
  patterns: z.array(
    z.object({
      description: z.string(),
      evidence_count: z.number().int(),
    }),
  ),
  proposed_changes: z.array(
    z.object({
      agent: z.enum(['plotter', 'plot_critic', 'writer', 'writer_critic']),
      current_text: z.string(),
      proposed_text: z.string(),
      rationale: z.string(),
      confidence: z.enum(['high', 'medium', 'low']),
    }),
  ),
})

export const StoryAnalysisOutputSchema = z.object({
  extracted_reactions: z.array(
    z.object({
      reaction_text: z.string(),
      surrounding_quote: z.string(),
    }),
  ),
  style_patterns: z.object({
    what_worked: z.array(z.string()),
    what_didnt_work: z.array(z.string()),
    structural_notes: z.string(),
  }),
  analysis_summary: z.string(),
})

export const UniverseFactExtractorOutputSchema = z.object({
  facts: z.array(z.object({
    fact_text: z.string(),
    suggested_character_name: z.string().nullable(),
  })).min(0).max(5),
})

export const IdeaSuggesterOutputSchema = z.object({
  topics: z.array(z.object({
    topic: z.string(),
    ideas: z.array(z.object({
      seed: z.string(),
      rationale: z.string(),
    })),
  })),
})

export type PsychologistOutput = z.infer<typeof PsychologistOutputSchema>
export type CriticOutput = z.infer<typeof CriticOutputSchema>
export type ImproverOutput = z.infer<typeof ImproverOutputSchema>
export type StoryAnalysisOutput = z.infer<typeof StoryAnalysisOutputSchema>
export type UniverseFactExtractorOutput = z.infer<typeof UniverseFactExtractorOutputSchema>
export type IdeaSuggesterOutput = z.infer<typeof IdeaSuggesterOutputSchema>
