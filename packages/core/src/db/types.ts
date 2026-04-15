import { z } from 'zod'
import { annotations, feedback, prompts, runSnapshots, stories } from './schema.js'

export type Story = typeof stories.$inferSelect
export type NewStory = typeof stories.$inferInsert

export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert

export type Prompt = typeof prompts.$inferSelect
export type NewPrompt = typeof prompts.$inferInsert

export type RunSnapshot = typeof runSnapshots.$inferSelect
export type NewRunSnapshot = typeof runSnapshots.$inferInsert

export type Annotation = typeof annotations.$inferSelect
export type NewAnnotation = typeof annotations.$inferInsert

export const storySchema = z.object({
  id: z.number().int(),
  title: z.string(),
  textFinal: z.string().nullable(),
  planV1: z.string().nullable(),
  planFinal: z.string().nullable(),
  planIterations: z.number().int().nullable(),
  textV1: z.string().nullable(),
  textV2: z.string().nullable(),
  plotterModel: z.string().nullable(),
  plotterPromptVersion: z.number().int().nullable(),
  plotCriticModel: z.string().nullable(),
  plotCriticPromptVersion: z.number().int().nullable(),
  writerModel: z.string().nullable(),
  writerPromptVersion: z.number().int().nullable(),
  writerCriticModel: z.string().nullable(),
  writerCriticPromptVersion: z.number().int().nullable(),
  createdAt: z.date().nullable(),
  status: z.enum(['draft', 'ready', 'read', 'archived']).nullable(),
  tags: z.unknown().nullable(),
  source: z.enum(['agent', 'legacy', 'user']).nullable(),
  isLegacy: z.boolean().nullable(),
  discussionQuestions: z.unknown().nullable(),
  seed: z.string().nullable(),
})

export const newStorySchema = z.object({
  title: z.string(),
  textFinal: z.string().optional(),
  planV1: z.string().optional(),
  planFinal: z.string().optional(),
  planIterations: z.number().int().optional(),
  textV1: z.string().optional(),
  textV2: z.string().optional(),
  plotterModel: z.string().optional(),
  plotterPromptVersion: z.number().int().optional(),
  plotCriticModel: z.string().optional(),
  plotCriticPromptVersion: z.number().int().optional(),
  writerModel: z.string().optional(),
  writerPromptVersion: z.number().int().optional(),
  writerCriticModel: z.string().optional(),
  writerCriticPromptVersion: z.number().int().optional(),
  status: z.enum(['draft', 'ready', 'read', 'archived']).optional(),
  tags: z.unknown().optional(),
  source: z.enum(['agent', 'legacy', 'user']).optional(),
  isLegacy: z.boolean().optional(),
  discussionQuestions: z.unknown().optional(),
  seed: z.string().optional(),
})

export const feedbackSchema = z.object({
  id: z.number().int(),
  storyId: z.number().int().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  comment: z.string().nullable(),
  feedbackType: z.enum(['agent_run', 'retrospective']).nullable(),
  createdAt: z.date().nullable(),
})

export const newFeedbackSchema = z.object({
  storyId: z.number().int().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
  feedbackType: z.enum(['agent_run', 'retrospective']).optional(),
})

export const promptSchema = z.object({
  id: z.number().int(),
  agent: z.enum(['plotter', 'plot_critic', 'writer', 'writer_critic', 'improver']).nullable(),
  version: z.number().int(),
  text: z.string(),
  createdAt: z.date().nullable(),
  changeReason: z.string().nullable(),
  sourceFeedbacks: z.unknown().nullable(),
})

export const newPromptSchema = z.object({
  agent: z.enum(['plotter', 'plot_critic', 'writer', 'writer_critic', 'improver']).optional(),
  version: z.number().int(),
  text: z.string(),
  changeReason: z.string().optional(),
  sourceFeedbacks: z.unknown().optional(),
})

export const runSnapshotSchema = z.object({
  id: z.number().int(),
  storyId: z.number().int().nullable(),
  plotterModel: z.string().nullable(),
  plotterPromptVersion: z.number().int().nullable(),
  psychologistPlanModel: z.string().nullable(),
  psychologistPlanPromptVersion: z.number().int().nullable(),
  plotCriticModel: z.string().nullable(),
  plotCriticPromptVersion: z.number().int().nullable(),
  writerModel: z.string().nullable(),
  writerPromptVersion: z.number().int().nullable(),
  psychologistTextModel: z.string().nullable(),
  psychologistTextPromptVersion: z.number().int().nullable(),
  writerCriticModel: z.string().nullable(),
  writerCriticPromptVersion: z.number().int().nullable(),
  planIterationsCount: z.number().int().nullable(),
  planV1: z.string().nullable(),
  planFinal: z.string().nullable(),
  psychologistPlanOutput: z.unknown().nullable(),
  plotCriticOutput: z.unknown().nullable(),
  textV1: z.string().nullable(),
  textV2: z.string().nullable(),
  psychologistTextOutput: z.unknown().nullable(),
  writerCriticOutput: z.unknown().nullable(),
  createdAt: z.date().nullable(),
})

export const newRunSnapshotSchema = z.object({
  storyId: z.number().int().optional(),
  plotterModel: z.string().optional(),
  plotterPromptVersion: z.number().int().optional(),
  psychologistPlanModel: z.string().optional(),
  psychologistPlanPromptVersion: z.number().int().optional(),
  plotCriticModel: z.string().optional(),
  plotCriticPromptVersion: z.number().int().optional(),
  writerModel: z.string().optional(),
  writerPromptVersion: z.number().int().optional(),
  psychologistTextModel: z.string().optional(),
  psychologistTextPromptVersion: z.number().int().optional(),
  writerCriticModel: z.string().optional(),
  writerCriticPromptVersion: z.number().int().optional(),
  planIterationsCount: z.number().int().optional(),
  planV1: z.string().optional(),
  planFinal: z.string().optional(),
  psychologistPlanOutput: z.unknown().optional(),
  plotCriticOutput: z.unknown().optional(),
  textV1: z.string().optional(),
  textV2: z.string().optional(),
  psychologistTextOutput: z.unknown().optional(),
  writerCriticOutput: z.unknown().optional(),
})

export const annotationSchema = z.object({
  id: z.number().int(),
  storyId: z.number().int().nullable(),
  type: z.enum(['sasha_reaction', 'my_note', 'sasha_laughed', 'sasha_loved', 'sasha_disliked']),
  selectedText: z.string(),
  positionStart: z.number().int().nullable(),
  positionEnd: z.number().int().nullable(),
  createdAt: z.date().nullable(),
})

export const newAnnotationSchema = z.object({
  storyId: z.number().int().optional(),
  type: z.enum(['sasha_reaction', 'my_note', 'sasha_laughed', 'sasha_loved', 'sasha_disliked']),
  selectedText: z.string(),
  positionStart: z.number().int().optional(),
  positionEnd: z.number().int().optional(),
})
