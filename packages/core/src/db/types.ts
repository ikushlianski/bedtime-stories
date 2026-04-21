import { z } from 'zod'
import { annotations, childDiary, childProfiles, childReactions, feedback, parentReviews, planConversations, planQuestions, prompts, runSnapshots, stories, storyGroups, storyReadings, universeCharacters, universeSuggestions } from './schema.js'

export type StoryGroup = typeof storyGroups.$inferSelect
export type NewStoryGroup = typeof storyGroups.$inferInsert

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

export type ChildDiary = typeof childDiary.$inferSelect
export type NewChildDiary = typeof childDiary.$inferInsert

export type ChildProfile = typeof childProfiles.$inferSelect
export type NewChildProfile = typeof childProfiles.$inferInsert

export const childProfileSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  age: z.number().int().nullable(),
  activities: z.string().nullable(),
  interests: z.string().nullable(),
  dislikes: z.string().nullable(),
  favourites: z.string().nullable(),
  notes: z.string().nullable(),
  updatedAt: z.date().nullable(),
})

export const storyGroupSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string(),
  agentOverrides: z.record(z.string(), z.string()).nullable(),
  createdAt: z.date().nullable(),
  styleGuide: z.string().nullable(),
})

export const newStoryGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  systemPrompt: z.string().min(1),
  agentOverrides: z.record(z.string(), z.string()).optional(),
})

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
  groupId: z.number().int().nullable(),
  mode: z.enum(['auto', 'manual']),
  textChangeSummary: z.string().nullable(),
  storyAnalysis: z.string().nullable(),
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
  groupId: z.number().int().optional(),
  mode: z.enum(['auto', 'manual']).optional(),
  textChangeSummary: z.string().optional(),
  storyAnalysis: z.string().optional(),
})

const structuredFeedbackSchema = z.object({
  enjoyed: z.number().int().min(1).max(5),
  was_funny: z.boolean(),
  was_scary: z.boolean(),
  too_long: z.boolean(),
  favorite_moment: z.string(),
  favorite_character: z.string(),
  understood_moral: z.boolean(),
  want_again: z.boolean(),
  notes: z.string(),
}).nullable()

export const feedbackSchema = z.object({
  id: z.number().int(),
  storyId: z.number().int().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  comment: z.string().nullable(),
  feedbackType: z.enum(['agent_run', 'retrospective']).nullable(),
  createdAt: z.date().nullable(),
  structuredFeedback: structuredFeedbackSchema.optional(),
})

export const newFeedbackSchema = z.object({
  storyId: z.number().int().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
  feedbackType: z.enum(['agent_run', 'retrospective']).optional(),
  structuredFeedback: structuredFeedbackSchema.optional(),
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
  sashaContext: z.string().nullable(),
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
  sashaContext: z.string().optional(),
})

export type PlanQuestion = typeof planQuestions.$inferSelect
export type NewPlanQuestion = typeof planQuestions.$inferInsert

export type PlanConversation = typeof planConversations.$inferSelect
export type NewPlanConversation = typeof planConversations.$inferInsert

export const planQuestionSchema = z.object({
  id: z.number().int(),
  storyId: z.number().int().nullable(),
  questionText: z.string(),
  answerText: z.string().nullable(),
  createdAt: z.date().nullable(),
  answeredAt: z.date().nullable(),
})

export const newPlanQuestionSchema = z.object({
  storyId: z.number().int().optional(),
  questionText: z.string(),
  answerText: z.string().optional(),
  answeredAt: z.date().optional(),
})

export const planConversationSchema = z.object({
  id: z.number().int(),
  storyId: z.number().int().nullable(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.date().nullable(),
})

export const newPlanConversationSchema = z.object({
  storyId: z.number().int().optional(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

export const annotationSchema = z.object({
  id: z.number().int(),
  storyId: z.number().int().nullable(),
  type: z.enum(['sasha_reaction', 'my_note', 'sasha_laughed', 'sasha_loved', 'sasha_disliked']),
  selectedText: z.string(),
  noteText: z.string().nullable(),
  positionStart: z.number().int().nullable(),
  positionEnd: z.number().int().nullable(),
  createdAt: z.date().nullable(),
})

export const newAnnotationSchema = z.object({
  storyId: z.number().int().optional(),
  type: z.enum(['sasha_reaction', 'my_note', 'sasha_laughed', 'sasha_loved', 'sasha_disliked']),
  selectedText: z.string(),
  noteText: z.string().optional(),
  positionStart: z.number().int().optional(),
  positionEnd: z.number().int().optional(),
})

export type ParentReview = typeof parentReviews.$inferSelect
export type NewParentReview = typeof parentReviews.$inferInsert

export type ChildReaction = typeof childReactions.$inferSelect
export type NewChildReaction = typeof childReactions.$inferInsert

export type UniverseCharacter = typeof universeCharacters.$inferSelect
export type NewUniverseCharacter = typeof universeCharacters.$inferInsert

export type UniverseSuggestion = typeof universeSuggestions.$inferSelect
export type NewUniverseSuggestion = typeof universeSuggestions.$inferInsert

export type StoryReading = typeof storyReadings.$inferSelect
export type NewStoryReading = typeof storyReadings.$inferInsert

export const childDiarySchema = z.object({
  id: z.number().int(),
  content: z.string(),
  createdAt: z.date().nullable(),
})

export const newChildDiarySchema = z.object({
  content: z.string().min(1),
})
